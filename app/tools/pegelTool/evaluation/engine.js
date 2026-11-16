/* pegelTool Phase 3 – provisional, DOM-free fixed-window calculation.
 * Technical calculation only. DIN 15905-5:2022-07 has NOT been verified
 * against the authorised text; this module never issues a DIN pass/fail.
 * Inputs are interval Leq measurements (not gliding LAeq_g30 values).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PegelToolEvaluation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const BLOCK_MS = 1800000;
  const LIMIT_LAEQ_DB = 99;
  const LIMIT_LCPEAK_DB = 135;
  const NOT_ASSESSABLE = 'not-assessable';

  function issue(code, message, extra) {
    return Object.assign({code, message, severity: 'warning'}, extra || {});
  }
  function finiteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }
  function localIso(ms) {
    // The importer stores local wall-clock as a UTC-shaped comparison number.
    // This is NOT an actual UTC instant or a timezone conversion.
    return new Date(ms).toISOString().slice(0, 19);
  }
  function unionMs(spans) {
    const sorted = spans.filter(s => s.end > s.start).sort((a, b) => a.start - b.start || a.end - b.end);
    let end = -Infinity, covered = 0, overlap = 0;
    for (const span of sorted) {
      if (span.start < end) overlap += Math.max(0, Math.min(end, span.end) - span.start);
      covered += Math.max(0, span.end - Math.max(span.start, end));
      end = Math.max(end, span.end);
    }
    return {covered, overlap};
  }
  function weightedLeq(entries) {
    if (!entries.length) return null;
    const max = entries.reduce((best, entry) => Math.max(best, entry.db), -Infinity);
    const seconds = entries.reduce((sum, e) => sum + e.ms, 0) / 1000;
    if (!(seconds > 0)) return null;
    const relativeEnergy = entries.reduce((sum, e) => sum + e.ms / 1000 * Math.pow(10, (e.db - max) / 10), 0);
    return max + 10 * Math.log10(relativeEnergy / seconds);
  }
  function threshold(value, limit) {
    return !finiteNumber(value) ? 'unknown' : value > limit ? 'above' : 'at-or-below';
  }
  function buildBlocks(intervals, options) {
    const opts = options || {};
    const warnings = [];
    const cleaned = [];
    for (let i = 0; i < (Array.isArray(intervals) ? intervals.length : 0); i++) {
      const v = intervals[i];
      if (!v || !finiteNumber(v.startMs) || !finiteNumber(v.endMs) || v.endMs <= v.startMs) {
        warnings.push(issue('INVALID_TIME_INTERVAL', 'Ungültiges Messintervall; nicht stillschweigend ersetzt.', {sampleIndex: i}));
        continue;
      }
      cleaned.push({
        startMs: v.startMs, endMs: v.endMs,
        laeqDb: finiteNumber(v.laeqDb) ? v.laeqDb : null,
        lcpeakDb: finiteNumber(v.lcpeakDb) ? v.lcpeakDb : null,
        sourceLine: v.sourceLine == null ? null : v.sourceLine
      });
    }
    if (!cleaned.length) return {
      version: VERSION, ruleStatus: 'not-verified', normativeStatus: NOT_ASSESSABLE,
      quality: {status: 'no-data', warnings: warnings.concat([issue('NO_INTERVALS', 'Keine auswertbaren Messintervalle.')])},
      blocks: [], overall: {laeqMaxDb: null, lcpeakMaxDb: null, comparisonLAeq: 'unknown', comparisonLCpeak: 'unknown'}
    };

    const first = cleaned.reduce((best, interval) => Math.min(best, interval.startMs), Infinity);
    const last = cleaned.reduce((best, interval) => Math.max(best, interval.endMs), -Infinity);
    const firstBlock = Math.floor(first / BLOCK_MS) * BLOCK_MS;
    const lastBlock = Math.ceil(last / BLOCK_MS) * BLOCK_MS;
    // Guard against malformed inputs accidentally generating an unbounded report.
    if ((lastBlock - firstBlock) / BLOCK_MS > 10000) return {
      version: VERSION, ruleStatus: 'not-verified', normativeStatus: NOT_ASSESSABLE,
      quality: {status: 'no-data', warnings: warnings.concat([issue('TOO_MANY_BLOCKS', 'Zeitbereich überschreitet 10.000 Blöcke.')])},
      blocks: [], overall: {laeqMaxDb: null, lcpeakMaxDb: null, comparisonLAeq: 'unknown', comparisonLCpeak: 'unknown'}
    };

    const blocks = [];
    let qualityStatus = 'complete';
    for (let from = firstBlock; from < lastBlock; from += BLOCK_MS) {
      const to = from + BLOCK_MS;
      const all = [], leqSpans = [], peakSpans = [], energy = [], peaks = [], sources = [];
      let crossingMs = 0;
      for (const iv of cleaned) {
        const start = Math.max(from, iv.startMs), end = Math.min(to, iv.endMs);
        if (end <= start) continue;
        const span = {start, end};
        all.push(span);
        if (iv.sourceLine != null) sources.push(iv.sourceLine);
        const crossed = Math.floor(iv.startMs / BLOCK_MS) !== Math.floor((iv.endMs - 0.001) / BLOCK_MS);
        if (crossed) crossingMs += end - start;
        if (iv.laeqDb != null) {
          leqSpans.push(span);
          energy.push({db: iv.laeqDb, ms: end - start});
        }
        if (iv.lcpeakDb != null) {
          peakSpans.push(span);
          peaks.push({db: iv.lcpeakDb, sourceLine: iv.sourceLine});
        }
      }
      const observed = unionMs(all), leq = unionMs(leqSpans), peak = unionMs(peakSpans);
      const coveredSeconds = observed.covered / 1000;
      const validLaeqSeconds = leq.covered / 1000;
      const validPeakSeconds = peak.covered / 1000;
      const unknownSeconds = Math.max(0, 1800 - coveredSeconds);
      const invalidLaeqSeconds = Math.max(0, coveredSeconds - validLaeqSeconds);
      const invalidPeakSeconds = Math.max(0, coveredSeconds - validPeakSeconds);
      const overlapSeconds = observed.overlap / 1000;
      const crossingBoundarySeconds = crossingMs / 1000;
      const fullCoverage = Math.abs(coveredSeconds - 1800) < 1e-6;
      const laeqCovered = Math.abs(validLaeqSeconds - 1800) < 1e-6;
      const peakCovered = Math.abs(validPeakSeconds - 1800) < 1e-6;
      const conflict = overlapSeconds > 1e-7 || crossingBoundarySeconds > 1e-7;
      const blockWarnings = [];
      if (unknownSeconds > 1e-7) blockWarnings.push(issue('INCOMPLETE_BLOCK', 'Keine lückenlose Abdeckung des 30-Minuten-Fensters.'));
      if (invalidLaeqSeconds > 1e-7) blockWarnings.push(issue('INVALID_LAEQ_DATA', 'LAeq-Intervalle fehlen oder sind nicht belegbar.'));
      if (invalidPeakSeconds > 1e-7) blockWarnings.push(issue('INVALID_LCPEAK_DATA', 'LCpeak-Intervalle fehlen oder sind nicht belegbar.'));
      if (overlapSeconds > 1e-7) blockWarnings.push(issue('OVERLAPPING_SAMPLES', 'Überlappende oder doppelte Zeitabschnitte wurden nicht mehrfach gezählt.'));
      if (crossingBoundarySeconds > 1e-7) blockWarnings.push(issue('BOUNDARY_CROSSING', 'Intervall über Halbstundengrenze: Energie und Peak sind nicht exakt zuordenbar.'));
      const observedLaeqDb = overlapSeconds > 1e-7 || crossingBoundarySeconds > 1e-7 ? null : weightedLeq(energy);
      const observedLcpeakDb = overlapSeconds > 1e-7 || crossingBoundarySeconds > 1e-7 || !peaks.length
        ? null : peaks.reduce((best, peak) => Math.max(best, peak.db), -Infinity);
      const laeq30Db = fullCoverage && laeqCovered && !conflict ? observedLaeqDb : null;
      const lcpeakMaxDb = fullCoverage && peakCovered && !conflict ? observedLcpeakDb : null;
      const dataQuality = conflict ? 'conflict' : !fullCoverage || !laeqCovered || !peakCovered ? 'incomplete' : 'complete';
      if (dataQuality === 'conflict') qualityStatus = 'conflict';
      else if (dataQuality === 'incomplete' && qualityStatus === 'complete') qualityStatus = 'incomplete';
      const peakSource = lcpeakMaxDb == null ? null : peaks.find(p => p.db === lcpeakMaxDb)?.sourceLine ?? null;
      blocks.push({
        start: localIso(from), end: localIso(to), startLocalMs: from, endLocalMs: to,
        expectedSeconds: 1800, coveredSeconds, unknownSeconds,
        validLaeqSeconds, invalidLaeqSeconds, validPeakSeconds, invalidPeakSeconds,
        overlapSeconds, crossingBoundarySeconds, dataQuality,
        laeqObservedDb: observedLaeqDb, lcpeakObservedDb: observedLcpeakDb,
        laeq30Db, lcpeakMaxDb, comparisonLAeq: threshold(laeq30Db, LIMIT_LAEQ_DB),
        comparisonLCpeak: threshold(lcpeakMaxDb, LIMIT_LCPEAK_DB),
        normativeStatus: NOT_ASSESSABLE, sourceLines: [...new Set(sources)],
        lcpeakSourceLine: peakSource, warnings: blockWarnings
      });
    }
    if (opts.forceUncertainTime) {
      warnings.push(issue('TIME_BASIS_UNVERIFIED', 'Zeitstempel-Semantik/Zeitzone nicht hinreichend nachgewiesen.'));
    }
    if (opts.sourceIssues && opts.sourceIssues.length) warnings.push(...opts.sourceIssues);
    const laeqMax = blocks.map(b => b.laeq30Db).filter(finiteNumber);
    const peakMax = blocks.map(b => b.lcpeakMaxDb).filter(finiteNumber);
    const laeqMaxDb = laeqMax.length ? Math.max(...laeqMax) : null;
    const lcpeakMaxDb = peakMax.length ? Math.max(...peakMax) : null;
    return {
      version: VERSION, ruleStatus: 'not-verified', normativeStatus: NOT_ASSESSABLE,
      assumptions: {blockDurationSeconds: 1800, alignment: 'local-clock-00-30', partialBlocks: 'no-normative-value',
        sliding30NotUsed: true, timeBasisVerified: !opts.forceUncertainTime},
      quality: {status: qualityStatus, warnings},
      blocks,
      overall: {laeqMaxDb, lcpeakMaxDb,
        comparisonLAeq: threshold(laeqMaxDb, LIMIT_LAEQ_DB),
        comparisonLCpeak: threshold(lcpeakMaxDb, LIMIT_LCPEAK_DB),
        completeBlocks: blocks.filter(b => b.dataQuality === 'complete').length,
        totalBlocks: blocks.length, normativeStatus: NOT_ASSESSABLE}
    };
  }

  function daylightIssue(timestamp) {
    // Conservative detection for Europe/Berlin when no UTC offset is available.
    // Other timezone rules are intentionally NOT guessed.
    const date = new Date(timestamp);
    const year = date.getUTCFullYear(), month = date.getUTCMonth();
    if (month !== 2 && month !== 9 || date.getUTCHours() !== 2) return null;
    const last = new Date(Date.UTC(year, month + 1, 0));
    const lastSunday = last.getUTCDate() - last.getUTCDay();
    if (date.getUTCDate() !== lastSunday) return null;
    return month === 9 ? 'DST_AMBIGUOUS' : 'DST_NONEXISTENT';
  }

  function corrected(raw, column, definition, metric, issues, issueKeys) {
    if (!finiteNumber(raw)) return null;
    function note(code, message) {
      const key = metric + ':' + code;
      if (!issueKeys.has(key)) {
        issueKeys.add(key);
        issues.push(issue(code, message));
      }
    }
    if (!column || (column.correctionApplied !== true && column.correctionApplied !== false)) {
      note('CORRECTION_ORIGIN_UNKNOWN', metric + ': Herkunft des Korrekturstatus ungeklärt.');
      return null;
    }
    if (column.correctionApplied === true) return raw; // Never correct twice.
    if (!definition || !finiteNumber(definition.valueDb) || definition.valueSource === 'missing') {
      note('CORRECTION_VALUE_MISSING', metric + ': noch nicht eingerechneter Korrekturwert fehlt.');
      return null;
    }
    return raw + definition.valueDb;
  }

  function evaluateModel(model, options) {
    const opts = options || {};
    const problems = [];
    const issueKeys = new Set();
    const anchor = opts.timestampAnchor;
    if (!model || model.schemaVersion !== 1 || !Array.isArray(model.samples) || model.quality?.status === 'rejected') {
      const failed = buildBlocks([]);
      failed.quality.warnings.push(issue('INVALID_IMPORT_MODEL', 'Importmodell fehlt oder ist nicht auswertbar.'));
      return failed;
    }
    if (anchor !== 'start' && anchor !== 'end') {
      const failed = buildBlocks([]);
      failed.quality.warnings.push(issue('TIMESTAMP_ANCHOR_MISSING', 'Start-/End-Semantik der Zeitstempel explizit wählen.'));
      return failed;
    }
    const seconds = model.measurement?.intervalSeconds;
    if (!finiteNumber(seconds) || seconds <= 0) {
      const failed = buildBlocks([]);
      failed.quality.warnings.push(issue('INVALID_LOG_INTERVAL', 'Import enthält kein gültiges Messintervall.'));
      return failed;
    }
    const dt = seconds * 1000;
    const intervals = [];
    for (const sample of model.samples) {
      const stamp = sample.localEpochMs;
      if (!finiteNumber(stamp)) {
        problems.push(issue('INVALID_SAMPLE_TIME', 'Messzeile mit ungültigem Zeitstempel.', {sourceLine: sample.sourceLine}));
        continue;
      }
      const zone = model.measurement?.timeZone;
      const dst = (!zone || /Europe\/Berlin/i.test(zone)) ? daylightIssue(stamp) : null;
      if (dst && !issueKeys.has(dst)) {
        issueKeys.add(dst);
        problems.push(issue(dst, 'Europe/Berlin: Zeitstempel bei Zeitumstellung ohne Offset nicht eindeutig.', {sourceLine: sample.sourceLine}));
      }
      const startMs = anchor === 'end' ? stamp - dt : stamp;
      const endMs = startMs + dt;
      intervals.push({
        startMs, endMs, sourceLine: sample.sourceLine,
        laeqDb: corrected(sample.values?.laeqDt, model.columns?.laeqDt, model.corrections?.k1, 'LAeq', problems, issueKeys),
        lcpeakDb: corrected(sample.values?.lcpeak, model.columns?.lcpeak, model.corrections?.k2, 'LCpeak', problems, issueKeys)
      });
    }
    const rawIssues = model.quality?.warnings || [];
    const riskyCodes = new Set(['TIME_REVERSAL', 'DUPLICATE_TIMESTAMP', 'IRREGULAR_INTERVAL',
      'TIME_GAP', 'INVALID_TIMESTAMP', 'INVALID_TIMESTAMP_COUNT']);
    for (const x of rawIssues) if (riskyCodes.has(x.code)) problems.push(issue('IMPORT_' + x.code, x.message, {sourceLine: x.line}));
    for (const kind of ['k1', 'k2']) {
      if (model.corrections?.[kind]?.determination == null)
        problems.push(issue('CORRECTION_DETERMINATION_UNVERIFIED', kind + ': Ermittlung der Messortkorrektur nicht dokumentiert.'));
    }
    if (model.calibration?.status !== 'verified')
      problems.push(issue('CALIBRATION_UNVERIFIED', 'Kalibrier-/Funktionsprüfung nicht vollständig belegt.'));
    if (!model.places?.assessmentLAeq || !model.places?.assessmentLCpeak)
      problems.push(issue('ASSESSMENT_PLACES_MISSING', 'Maßgebliche Immissionsorte nicht ausreichend dokumentiert.'));
    const assumedAnchor = opts.timestampAnchorEvidence !== 'verified';
    const result = buildBlocks(intervals, {
      forceUncertainTime: assumedAnchor || !model.measurement?.timeZone,
      sourceIssues: problems
    });
    result.assumptions = Object.assign({}, result.assumptions, {
      timestampAnchor: anchor,
      timestampAnchorEvidence: opts.timestampAnchorEvidence === 'verified' ? 'verified' : 'assumed',
      intervalSeconds: seconds,
      timeZone: model.measurement?.timeZone || null,
      corrections: {
        k1: {valueDb: model.corrections?.k1?.valueDb ?? null, appliedInLog: model.columns?.laeqDt?.correctionApplied ?? null},
        k2: {valueDb: model.corrections?.k2?.valueDb ?? null, appliedInLog: model.columns?.lcpeak?.correctionApplied ?? null}
      }
    });
    // Imported-source uncertainty can never become a positive outcome.
    if (problems.length || assumedAnchor) result.quality.status =
      result.quality.status === 'conflict' ? 'conflict' : 'restricted';
    return result;
  }
  return Object.freeze({
    VERSION, BLOCK_MS, LIMIT_LAEQ_DB, LIMIT_LCPEAK_DB,
    weightedLeq, buildBlocks, evaluateModel, threshold
  });
});

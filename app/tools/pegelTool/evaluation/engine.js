/* pegelTool Phase 3 – provisional, DOM-free fixed-window calculation.
 * Operator-approved assessment method; no external certification is asserted.
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
  // Detect actual missing intervals, excluding the unmeasured portions before/after a session.
  function missingSpans(spans, from, to) {
    const missing = [];
    let cursor = from;
    for (const span of spans.slice().sort((a,b) => a.start-b.start || a.end-b.end)) {
      if (span.start > cursor) missing.push({start:cursor,end:span.start});
      cursor = Math.max(cursor,span.end);
    }
    if (cursor < to) missing.push({start:cursor,end:to});
    return missing;
  }
  const showTime = ms => localIso(ms).replace('T',' ');
  const showSeconds = seconds => String(Number(seconds.toFixed(6))).replace('.',',') + ' s';
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
  function measuredStatus(blocks) {
    // Technical evidence and form / norm documentation are separate concerns.
    if (!blocks.length) return 'not-assessable';
    if (blocks.some(b => b.comparisonLAeq === 'above' || b.comparisonLCpeakObserved === 'above'))
      return 'exceeded';
    const assessedLAeq = blocks.some(b => finiteNumber(b.laeq30Db));
    const assessedPeak = blocks.some(b => finiteNumber(b.lcpeakObservedDb));
    return assessedLAeq && assessedPeak ? 'within-limits' :
      assessedLAeq || assessedPeak ? 'partial' : 'not-assessable';
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
      blocks: [], overall: {laeqMaxDb: null, lcpeakMaxDb: null, comparisonLAeq: 'unknown', comparisonLCpeak: 'unknown', normativeStatus: NOT_ASSESSABLE}
    };

    const first = cleaned.reduce((best, interval) => Math.min(best, interval.startMs), Infinity);
    const last = cleaned.reduce((best, interval) => Math.max(best, interval.endMs), -Infinity);
    const firstBlock = Math.floor(first / BLOCK_MS) * BLOCK_MS;
    const lastBlock = Math.ceil(last / BLOCK_MS) * BLOCK_MS;
    // Guard against malformed inputs accidentally generating an unbounded report.
    if ((lastBlock - firstBlock) / BLOCK_MS > 10000) return {
      version: VERSION, ruleStatus: 'not-verified', normativeStatus: NOT_ASSESSABLE,
      quality: {status: 'no-data', warnings: warnings.concat([issue('TOO_MANY_BLOCKS', 'Zeitbereich überschreitet 10.000 Blöcke.')])},
      blocks: [], overall: {laeqMaxDb: null, lcpeakMaxDb: null, comparisonLAeq: 'unknown', comparisonLCpeak: 'unknown', normativeStatus: NOT_ASSESSABLE}
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
          peaks.push({db: iv.lcpeakDb, sourceLine: iv.sourceLine,
            startMs: iv.startMs, endMs: iv.endMs});
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
      const missing = missingSpans(all, Math.max(from,first), Math.min(to,last));
      const missingWithinMeasurementSeconds = missing.reduce((sum,span)=>sum+(span.end-span.start)/1000,0);
      const blockLabel = showTime(from) + ' – ' + showTime(to) + ': ';
      for (const span of missing) {
        blockWarnings.push(issue('INCOMPLETE_BLOCK', 'Messlücke: ' + showTime(span.start) + ' – ' +
          showTime(span.end) + ' (' + showSeconds((span.end-span.start)/1000) + ' fehlen).'));
      }
      if (invalidLaeqSeconds > 1e-7) blockWarnings.push(issue('INVALID_LAEQ_DATA', blockLabel + 'LAeq-Messwerte fehlen oder sind ungültig (' + showSeconds(invalidLaeqSeconds) + ').'));
      if (invalidPeakSeconds > 1e-7) blockWarnings.push(issue('INVALID_LCPEAK_DATA', blockLabel + 'LCpeak-Messwerte fehlen oder sind ungültig (' + showSeconds(invalidPeakSeconds) + ').'));
      if (overlapSeconds > 1e-7) blockWarnings.push(issue('OVERLAPPING_SAMPLES', blockLabel + 'Doppelte/überlappende Messintervalle (' + showSeconds(overlapSeconds) + ').'));
      if (crossingBoundarySeconds > 1e-7) blockWarnings.push(issue('BOUNDARY_CROSSING', blockLabel + 'Intervall über Halbstundengrenze (' + showSeconds(crossingBoundarySeconds) + ' im Block): Energie und Peak nicht exakt zuordenbar.'));
      const observedLaeqDb = overlapSeconds > 1e-7 || crossingBoundarySeconds > 1e-7 ? null : weightedLeq(energy);
      const observedLcpeakDb = overlapSeconds > 1e-7 || crossingBoundarySeconds > 1e-7 || !peaks.length
        ? null : peaks.reduce((best, peak) => Math.max(best, peak.db), -Infinity);
      const laeq30Db = fullCoverage && laeqCovered && !conflict ? observedLaeqDb : null;
      const laeqPartialDb = !fullCoverage || !laeqCovered ? observedLaeqDb : null;
      const lcpeakMaxDb = fullCoverage && peakCovered && !conflict ? observedLcpeakDb : null;
      const dataQuality = conflict ? 'conflict' : !fullCoverage || !laeqCovered || !peakCovered ? 'incomplete' : 'complete';
      const edgePartial = !fullCoverage && (from < first || to > last);
      const dataCoverageState = conflict ? 'conflict' : dataQuality === 'complete' ? 'full' :
        edgePartial && missingWithinMeasurementSeconds === 0 && invalidLaeqSeconds === 0 && invalidPeakSeconds === 0 ? 'partial-edge' : 'gap';
      if (dataQuality === 'conflict') qualityStatus = 'conflict';
      else if (dataQuality === 'incomplete' && qualityStatus === 'complete') qualityStatus = 'incomplete';
      const peakSource = lcpeakMaxDb == null ? null : peaks.find(p => p.db === lcpeakMaxDb)?.sourceLine ?? null;
      const peakObservedSourceLine = observedLcpeakDb == null ? null :
        peaks.find(p => p.db === observedLcpeakDb)?.sourceLine ?? null;
      // Only unambiguous, whole intervals can be attributed to this block.
      const peakEvents = [];
      if (!conflict) {
        const counted = new Set();
        for (const p of peaks) {
          if (p.db <= LIMIT_LCPEAK_DB || p.startMs < from || p.endMs > to) continue;
          const key = p.startMs + ':' + p.endMs;
          if (counted.has(key)) continue;
          counted.add(key);
          peakEvents.push({start: localIso(p.startMs), end: localIso(p.endMs),
            valueDb: p.db, sourceLine: p.sourceLine});
        }
      }
      blocks.push({
        start: localIso(from), end: localIso(to), startLocalMs: from, endLocalMs: to,
        expectedSeconds: 1800, coveredSeconds, unknownSeconds, missingWithinMeasurementSeconds,
        validLaeqSeconds, invalidLaeqSeconds, validPeakSeconds, invalidPeakSeconds,
        overlapSeconds, crossingBoundarySeconds, dataQuality, dataCoverageState,
        laeqObservedDb: observedLaeqDb, laeqPartialDb, lcpeakObservedDb: observedLcpeakDb,
        laeq30Db, lcpeakMaxDb, comparisonLAeq: threshold(laeq30Db, LIMIT_LAEQ_DB),
        comparisonLCpeak: threshold(lcpeakMaxDb, LIMIT_LCPEAK_DB),
        comparisonLCpeakObserved: threshold(observedLcpeakDb, LIMIT_LCPEAK_DB),
        normativeStatus: NOT_ASSESSABLE, sourceLines: [...new Set(sources)],
        lcpeakSourceLine: peakSource, lcpeakObservedSourceLine: peakObservedSourceLine,
        peakEvents, warnings: blockWarnings
      });
    }
    if (opts.forceUncertainTime) {
      warnings.push(issue('TIME_BASIS_UNVERIFIED', 'Zeitstempel-Semantik/Zeitzone nicht hinreichend nachgewiesen.'));
    }
    if (opts.sourceIssues && opts.sourceIssues.length) warnings.push(...opts.sourceIssues);
    const laeqMax = blocks.map(b => b.laeq30Db).filter(finiteNumber);
    const peakMax = blocks.map(b => b.lcpeakObservedDb).filter(finiteNumber);
    const peakCompleteMax = blocks.map(b => b.lcpeakMaxDb).filter(finiteNumber);
    const laeqMaxDb = laeqMax.length ? Math.max(...laeqMax) : null;
    // Highest observed peak includes partial first/last windows.
    const lcpeakMaxDb = peakMax.length ? Math.max(...peakMax) : null;
    const lcpeakCompleteMaxDb = peakCompleteMax.length ? Math.max(...peakCompleteMax) : null;
    const peakEvents = blocks.flatMap(b => b.peakEvents);
    const laeqExceededBlocks = blocks.filter(b => b.comparisonLAeq === 'above')
      .map(b => ({start:b.start, end:b.end, valueDb:b.laeq30Db}));
    const measurementStatus = measuredStatus(blocks);
    const coverageComplete = blocks.every(b => b.dataQuality === 'complete');
    const hasMeasurementGaps = blocks.some(b => b.dataCoverageState === 'gap' || b.dataCoverageState === 'conflict');
    return {
      version: VERSION, ruleStatus: 'operator-approved', normativeStatus: NOT_ASSESSABLE, measurementStatus,
      assumptions: {blockDurationSeconds: 1800, alignment: 'local-clock-00-30', partialBlocks: 'no-normative-value',
        sliding30NotUsed: true, timeBasisVerified: !opts.forceUncertainTime},
      quality: {status: qualityStatus, warnings},
      blocks,
      overall: {laeqMaxDb, lcpeakMaxDb, lcpeakCompleteMaxDb,
        comparisonLAeq: threshold(laeqMaxDb, LIMIT_LAEQ_DB),
        comparisonLCpeak: threshold(lcpeakMaxDb, LIMIT_LCPEAK_DB),
        laeqExceededBlocks, laeqExceededCount: laeqExceededBlocks.length,
        lcpeakExceededIntervals: peakEvents, lcpeakExceededCount: peakEvents.length,
        completeBlocks: blocks.filter(b => b.dataQuality === 'complete').length,
        totalBlocks: blocks.length, coverageComplete, hasMeasurementGaps,
        normativeStatus: NOT_ASSESSABLE, measurementStatus}
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
    // Metadata entered in the protocol is checked there, not against import-only fields.
    const assumedAnchor = !['verified','operator-approved'].includes(opts.timestampAnchorEvidence);
    const result = buildBlocks(intervals, {
      forceUncertainTime: assumedAnchor || !model.measurement?.timeZone,
      sourceIssues: problems
    });
    result.assumptions = Object.assign({}, result.assumptions, {
      timestampAnchor: anchor,
      timestampAnchorEvidence: ['verified','operator-approved'].includes(opts.timestampAnchorEvidence) ? opts.timestampAnchorEvidence : 'assumed',
      intervalSeconds: seconds,
      timeZone: model.measurement?.timeZone || null,
      corrections: {
        k1: {valueDb: model.corrections?.k1?.valueDb ?? null, appliedInLog: model.columns?.laeqDt?.correctionApplied ?? null},
        k2: {valueDb: model.corrections?.k2?.valueDb ?? null, appliedInLog: model.columns?.lcpeak?.correctionApplied ?? null}
      }
    });
    // Technical comparisons remain visible. Missing evidence changes quality, not measured levels.
    if (problems.length || assumedAnchor) {
      result.quality.status = result.quality.status === 'conflict' ? 'conflict' : 'restricted';
    }
    return result;
  }
  return Object.freeze({
    VERSION, BLOCK_MS, LIMIT_LAEQ_DB, LIMIT_LCPEAK_DB,
    weightedLeq, buildBlocks, evaluateModel, threshold
  });
});

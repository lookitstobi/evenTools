'use strict';
// Phase 7 true Chromium workflow smoke test with synthetic log files.
// The test server emulates only the approved toolserve.php file routing;
// it does NOT exercise PHP authentication, production CSP or actual DIN compliance.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../../..');
const BASE=path.join(ROOT,'app/tools/pegelTool');
const SOURCE=path.join(ROOT,'tests/pegelTool/fixtures/valid-with-summary.txt');
const OUTPUT=process.env.PEGELTOOL_BROWSER_ARTIFACTS || path.join(os.tmpdir(),'pegeltool-phase7-browser');
const MIME={'.js':'application/javascript','.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function serve(){
  return http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    let file;
    if(url.pathname==='/toolserve.php' && url.searchParams.get('name')==='pegelTool')
      file=path.resolve(BASE,url.searchParams.get('file')||'index.html');
    else if(url.pathname==='/assets/app.css')
      file=path.resolve(ROOT,'assets/app.css');
    else {res.writeHead(404);res.end('Not found');return;}
    if(!(file.startsWith(BASE+path.sep)||file===path.join(BASE,'index.html')
      ||file===path.resolve(ROOT,'assets/app.css'))){
      res.writeHead(403);res.end('Forbidden');return;
    }
    try{res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');
      res.end(fs.readFileSync(file));}
    catch(_err){res.writeHead(404);res.end('Missing');}
  });
}
function downloadPath(name){return path.join(OUTPUT,name);}
test('Chromium: import → assess → save JSON/HTML → reload → PDF; mobile and failed import',
  {timeout:120000},async()=>{
    fs.mkdirSync(OUTPUT,{recursive:true});
    const server=serve();
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    page.on('dialog',dialog=>dialog.dismiss());
    const entry='http://127.0.0.1:'+server.address().port+'/toolserve.php?name=pegelTool';
    try {
      await page.goto(entry,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.querySelectorAll('.workflow-group').length===5);
      assert.doesNotMatch(await page.locator('body').innerText(),/Keine DIN-Konformitätsbescheinigung|DIN-Konformitätsbescheinigung/i);
      const first=await page.evaluate(()=>buildStateObject());
      assert.ok(!first.importModel);
      // Before import the UI must already be one scrollable page, not six tabs.
      assert.equal(await page.locator('.workflow-group').count(),5);
      assert.equal(await page.locator('.workflow-nav,.workflow-tab,.workflow-panel').count(),0);
      assert.equal(await page.locator('#workflow-group-setup').isVisible(),true);
      assert.equal(await page.locator('#workflow-group-quality').isVisible(),true);
      assert.equal(await page.locator('#workflow-group-assessment').isVisible(),true);
      const layout=await page.evaluate(()=>({
        bodyOverflow:getComputedStyle(document.body).overflowY,
        scrollHeight:document.scrollingElement.scrollHeight,
        viewportHeight:document.scrollingElement.clientHeight
      }));
      assert.equal(layout.bodyOverflow,'auto');
      assert.ok(layout.scrollHeight>layout.viewportHeight,'Single-page content must scroll');
      // Defaults come from "Manuelle Eingaben prüfen": editable, never fabricated measurements.
      assert.equal(first.form.organisator,
        'Theater und Philharmonie Essen GmbH\nOpernplatz 10\n45128 Essen\n'+
        'Geschäftsführer: Fritz Frömming\nIntendanz Philharmonie Essen: Babette Nierenz');
      assert.equal(first.form.ortAdresse,'Huyssenallee 53, 45128 Essen');
      assert.equal(first.form.umwelt,'Indoor, 21°C');
      assert.equal(first.form.kalibratorModell,'CENTER 326');
      assert.equal(first.form.kalibratorSN,'140408454');
      assert.equal(first.form.berichtsort,'Essen');
      assert.match(first.form.berichtDatum,/^\d{4}-\d{2}-\d{2}$/);
      assert.equal(first.form.datumMessung,'');
      assert.equal(first.form.kalVorBestaetigt,'');
      assert.equal(first.form.kalNachBestaetigt,'');
      assert.equal(first.form.messort,'');
      assert.equal(first.form.paZusatz,'');
      assert.equal(await page.locator('#messortLAeq,#messortLCpeak,#btnAddPA,#kalVorZeit,#k1Ermittlung').count(),0);
      assert.equal(await page.locator('.workflow-issue-details').count(),0);
      assert.equal(await page.locator('.workflow-shortinfo-item').count(),6);
      assert.equal(await page.locator('#lautestePosition').count(),0);
      assert.equal(Object.hasOwn(first.form,'lautestePosition'),false);
      const placement=await page.evaluate(()=>{
        const rect=id=>document.querySelector(id).getBoundingClientRect();
        const sameWidth=(a,b)=>Math.abs(rect(a).width-rect(b).width)<=1;
        return {
          chartsFirst:document.querySelector('#main').firstElementChild===
            document.querySelector('[data-workflow-section="charts"]'),
          chartsAboveSetup:rect('[data-workflow-section="charts"]').bottom<
            rect('#workflow-group-setup').top,
          descriptionBelowName:rect('#beschreibung').top>rect('#eventName').bottom,
          descriptionBeforeDate:rect('#beschreibung').bottom<rect('#datumMessung').top,
          fohAfterMessperson:rect('#foh').top>rect('#messungVon').bottom,
          fohBeforePosition:rect('#foh').bottom<rect('#messposition').top,
          positionsEqual:sameWidth('#messposition','#messort'),
          peopleEqual:sameWidth('#messungVon','#foh'),
          eventFieldsEqual:sameWidth('#eventName','#datumMessung')
        };
      });
      for(const [key,ok] of Object.entries(placement))
        assert.equal(ok,true,'Layout: '+key+' must be true');
      assert.equal(first.protocolMeta.origins.organisator,'preset-unverified');
      assert.equal(first.paSelection.schemaVersion,2);
      assert.equal(first.paItems.find(x=>x.type==='L-ACOUSTIC KARA II').qty,24);
      assert.equal(first.paItems.find(x=>x.type==='L-ACOUSTIC KS21').qty,8);
      assert.equal(first.paItems.find(x=>x.type==='L-ACOUSTIC 5XT').qty,7);
      assert.equal(first.paSelection.variants.sideL,'ks4');
      assert.equal(first.paSelection.variants.sideR,'ks4');
      assert.equal(await page.locator('#btnPdfTemplate').isDisabled(),true);

      await page.locator('#fileInput').setInputFiles(SOURCE);
      await page.waitForFunction(()=>buildStateObject().importModel?.samples?.length===4);
      const state=await page.evaluate(()=>buildStateObject());
      assert.equal(state.importModel.samples.length,4);
      assert.equal(state.importModel.schemaVersion,1);
      assert.equal(state.logLoaded,true);
      assert.equal(state.importModel.summary.verified,false);
      assert.equal(await page.locator('#btnPdfTemplate').isDisabled(),false);
      const originalRows=JSON.stringify(state.importModel.samples);
      const shownLevels=await page.evaluate(()=>{
        const o=phase3Evaluation?.overall || {};
        const label=n=>Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';
        return {
          actual:[...document.querySelectorAll('.workflow-shortinfo-value')].slice(4).map(n=>n.textContent),
          expected:[label(o.laeqMaxDb)+(Number.isFinite(o.laeqMaxDb)?' dB(A)':''),
            label(o.lcpeakMaxDb)+(Number.isFinite(o.lcpeakMaxDb)?' dB(C)':'')]
        };
      });
      assert.deepEqual(shownLevels.actual,shownLevels.expected);
      assert.match(await page.locator('body').innerText(),/Nicht beurteilbar/i);

      // A rejected new file must not destroy the previously imported measurement.
      await page.locator('#fileInput').setInputFiles(path.join(ROOT,'tests/pegelTool/fixtures/invalid-not-xl3.txt'));
      await page.waitForFunction(()=>document.querySelector('#parseInfo')?.textContent.includes('rejected'));
      assert.equal(await page.evaluate(()=>JSON.stringify(buildStateObject().importModel.samples)),originalRows);
      assert.match(await page.locator('#chipLog').innerText(),/vorherige Messung geladen/i);

      // The two sides start with 4 × KS21 + Focus + Wide each; each side can change.
      await page.locator('#paContainer [data-pa-variant="sideL"]').selectOption('ks2');
      let changed=await page.evaluate(()=>buildStateObject());
      assert.equal(changed.paItems.find(x=>x.type==='L-ACOUSTIC KS21').qty,6);
      assert.equal(changed.paSelection.variants.sideR,'ks4');
      // AKS frontfill 1+9 is not in the 7-fill default; adding it adds exactly two.
      assert.equal(await page.locator('#paContainer .pa-node[data-pa-group="ff19"]').count(),2);
      await page.locator('#paContainer .pa-node[data-pa-group="ff19"]').first().click();
      assert.equal(await page.locator('#paContainer .pa-node[data-pa-group="ff19"][aria-pressed="true"]').count(),2);
      const paBeforeSave=await page.evaluate(()=>buildStateObject());
      assert.equal(paBeforeSave.paItems.find(x=>x.type==='L-ACOUSTIC KARA II').qty,24);
      assert.equal(paBeforeSave.paItems.find(x=>x.type==='L-ACOUSTIC 5XT').qty,9);
      assert.equal(paBeforeSave.paItems.find(x=>x.type==='L-ACOUSTIC KS21').qty,6);
      assert.ok(paBeforeSave.paSelection.selected.includes('ff19'));
      assert.ok(paBeforeSave.paSelection.selected.includes('mainL'));
      assert.ok(paBeforeSave.paSelection.selected.includes('mainR'));
      assert.equal(paBeforeSave.paExtras.length,0);

      await page.locator('#eventName').fill('Phase 7 Browserprüfung');
      await page.locator('#messposition').fill('FOH');
      await page.locator('#messort').fill('Reihe 3 Mitte');
      await page.locator('#kalVorBestaetigt').check();
      await page.locator('#kalNachBestaetigt').check();
      await page.locator('#paZusatz').fill('2 × zusätzliche Delaylautsprecher');
      assert.equal(await page.locator('#workflow-group-assessment').isVisible(),true);
      assert.equal(await page.locator('#workflow-group-export').isVisible(),true);
      // Tabbing from a manual entry must not land on automatic read-only fields.
      await page.locator('#eventName').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'beschreibung');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'datumMessung');

      const jsonWaiting=page.waitForEvent('download',{timeout:15000});
      await page.locator('#workflow-group-export button').filter({hasText:'Projekt speichern (JSON)'}).click();
      const jsonDownload=await jsonWaiting;
      await jsonDownload.saveAs(downloadPath('projekt.nti.json'));
      const saved=JSON.parse(fs.readFileSync(downloadPath('projekt.nti.json'),'utf8'));
      assert.equal(saved.form.eventName,'Phase 7 Browserprüfung');
      assert.equal(Object.hasOwn(saved.form,'lautestePosition'),false);
      assert.equal(saved.form.messort,'Reihe 3 Mitte');
      assert.equal(saved.form.kalVorBestaetigt,'ja');
      assert.equal(saved.form.kalNachBestaetigt,'ja');
      assert.equal(saved.form.paZusatz,'2 × zusätzliche Delaylautsprecher');
      assert.deepEqual(saved.paSelection.selected,paBeforeSave.paSelection.selected);
      assert.equal(saved.paSelection.schemaVersion,2);
      assert.equal(saved.paSelection.variants.sideL,'ks2');

      assert.equal(JSON.stringify(saved.importModel.samples),originalRows);

      const htmlWaiting=page.waitForEvent('download',{timeout:15000});
      await page.locator('#workflow-group-export button').filter({hasText:'Projekt speichern (HTML)'}).click();
      const htmlDownload=await htmlWaiting;
      await htmlDownload.saveAs(downloadPath('projekt.html'));
      const html=fs.readFileSync(downloadPath('projekt.html'),'utf8');
      assert.match(html,/window\.__SAVED_STATE__ = \{/);
      assert.ok(html.includes('Phase 7 Browserprüfung'));

      const pdfWaiting=page.waitForEvent('download',{timeout:15000});
      await page.locator('#workflow-group-export button').filter({hasText:'Messbericht als PDF exportieren'}).click();
      const pdfDownload=await pdfWaiting;
      await pdfDownload.saveAs(downloadPath('bericht.pdf'));
      const bytes=fs.readFileSync(downloadPath('bericht.pdf'));
      assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
      assert.ok(bytes.includes(Buffer.from('%%EOF')));
      assert.ok(bytes.length>1000);

      await page.screenshot({path:downloadPath('desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.locator('#workflow-group-assessment').isVisible(),true);
      await page.screenshot({path:downloadPath('mobile.png'),fullPage:true});

      // New page simulates opening an older working session from a JSON export.
      await page.goto(entry,{waitUntil:'networkidle'});
      await page.locator('#stateInput').setInputFiles({
        name:'projekt.nti.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
      await page.waitForFunction(()=>buildStateObject().form.eventName==='Phase 7 Browserprüfung');
      const loaded=await page.evaluate(()=>buildStateObject());
      assert.equal(JSON.stringify(loaded.importModel.samples),originalRows);
      assert.equal(loaded.form.eventName,'Phase 7 Browserprüfung');
      const old=await page.evaluate(saved=>{
        const legacy=structuredClone(saved);
        legacy.form.lautestePosition='Nicht als Immissionsort übernehmen';
        legacy.form.messort='';
        const n=normalizeState(legacy);
        return {form:n.form,serialized:JSON.stringify(n.form)};
      },saved);
      assert.equal(Object.hasOwn(old.form,'lautestePosition'),false);
      assert.equal(old.form.messort,'');
      assert.doesNotMatch(old.serialized,/lautestePosition/);
      assert.equal(loaded.form.messort,'Reihe 3 Mitte');
      assert.equal(loaded.form.kalVorBestaetigt,'ja');
      assert.equal(loaded.form.kalNachBestaetigt,'ja');
      assert.equal(await page.locator('#kalNachBestaetigt').isChecked(),true);
      assert.deepEqual(loaded.paSelection.selected,saved.paSelection.selected);
      assert.equal(loaded.paSelection.variants.sideL,'ks2');
      assert.equal(loaded.paItems.find(x=>x.type==='L-ACOUSTIC 5XT').qty,9);
      assert.equal(documentedStatus(await page.locator('body').innerText()),true);

      // HTML export is also an importable project carrier, no duplicate UI.
      await page.locator('#stateInput').setInputFiles({
        name:'projekt.html',mimeType:'text/html',buffer:Buffer.from(html)});
      await page.waitForFunction(()=>buildStateObject().form.eventName==='Phase 7 Browserprüfung');
      assert.equal(await page.locator('.workflow-shell').count(),1);
      assert.equal(await page.locator('.workflow-group').count(),5);
      // Pavillon main L/R each have 2 KS21, 2 Focus and 1 Wide. Center adds one Wide.
      await page.locator('#location').selectOption({label:'Philharmonie Essen, Nationalbank-Pavillon'});
      const pv=await page.evaluate(()=>buildStateObject());
      assert.equal(pv.paSelection.location,'Philharmonie Essen, Nationalbank-Pavillon');
      assert.ok(!pv.paSelection.selected.includes('ff19'));
      assert.deepEqual(pv.paSelection.selected,['mainL','mainR','center','ff17','ff35','ff4']);
      assert.equal(pv.paItems.find(x=>x.type==='L-ACOUSTIC KS21').qty,4);
      assert.equal(pv.paItems.find(x=>x.type==='L-ACOUSTIC A10 Focus').qty,4);
      assert.equal(pv.paItems.find(x=>x.type==='L-ACOUSTIC A10 Wide').qty,3);
      assert.equal(pv.paItems.find(x=>x.type==='L-ACOUSTIC 5XT').qty,5);
      assert.equal(await page.locator('#paContainer .pa-unresolved').isVisible(),false);
      assert.equal(pv.paExtras.length,0);
      // Removing only one side removes precisely its components.
      await page.locator('#paContainer .pa-group-toggle[data-pa-group="mainL"]').click();
      const pvOneSide=await page.evaluate(()=>buildStateObject());
      assert.equal(pvOneSide.paItems.find(x=>x.type==='L-ACOUSTIC KS21').qty,2);
      assert.equal(pvOneSide.paItems.find(x=>x.type==='L-ACOUSTIC A10 Focus').qty,2);
      assert.equal(pvOneSide.paItems.find(x=>x.type==='L-ACOUSTIC A10 Wide').qty,2);
      // Custom locations must not inherit the Essen venue address as evidence.
      await page.locator('#location').selectOption({label:'Eigene Angabe'});
      assert.equal(await page.locator('#ortAdresse').inputValue(),'');
      await page.locator('#ortAdresse').fill('Eigene Straße 1, 12345 Beispielstadt');
      await page.locator('#location').selectOption({label:'Philharmonie Essen, Alfried-Krupp-Saal'});
      assert.equal(await page.locator('#ortAdresse').inputValue(),'Eigene Straße 1, 12345 Beispielstadt');
      assert.deepEqual(pageErrors,[],'Unhandled browser JS exceptions: '+pageErrors.join('; '));
    } finally {
      await browser.close();
      await new Promise(resolve=>server.close(resolve));
    }
  });
function documentedStatus(text){return /Nicht beurteilbar/i.test(text);}

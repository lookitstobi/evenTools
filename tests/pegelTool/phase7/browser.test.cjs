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
      assert.match(await page.locator('body').innerText(),/Nicht beurteilbar/i);

      // A rejected new file must not destroy the previously imported measurement.
      await page.locator('#fileInput').setInputFiles(path.join(ROOT,'tests/pegelTool/fixtures/invalid-not-xl3.txt'));
      await page.waitForFunction(()=>document.querySelector('#parseInfo')?.textContent.includes('rejected'));
      assert.equal(await page.evaluate(()=>JSON.stringify(buildStateObject().importModel.samples)),originalRows);
      assert.match(await page.locator('#chipLog').innerText(),/vorherige Messung geladen/i);

      await page.locator('#eventName').fill('Phase 7 Browserprüfung');
      assert.equal(await page.locator('#workflow-group-assessment').isVisible(),true);
      assert.equal(await page.locator('#workflow-group-export').isVisible(),true);
      // Tabbing from a manual entry must not land on automatic read-only fields.
      await page.locator('#eventName').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'datumMessung');

      const jsonWaiting=page.waitForEvent('download',{timeout:15000});
      await page.locator('#workflow-group-export button').filter({hasText:'Projekt speichern (JSON)'}).click();
      const jsonDownload=await jsonWaiting;
      await jsonDownload.saveAs(downloadPath('projekt.nti.json'));
      const saved=JSON.parse(fs.readFileSync(downloadPath('projekt.nti.json'),'utf8'));
      assert.equal(saved.form.eventName,'Phase 7 Browserprüfung');
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
      assert.equal(documentedStatus(await page.locator('body').innerText()),true);

      // HTML export is also an importable project carrier, no duplicate UI.
      await page.locator('#stateInput').setInputFiles({
        name:'projekt.html',mimeType:'text/html',buffer:Buffer.from(html)});
      await page.waitForFunction(()=>buildStateObject().form.eventName==='Phase 7 Browserprüfung');
      assert.equal(await page.locator('.workflow-shell').count(),1);
      assert.equal(await page.locator('.workflow-group').count(),5);
      assert.deepEqual(pageErrors,[],'Unhandled browser JS exceptions: '+pageErrors.join('; '));
    } finally {
      await browser.close();
      await new Promise(resolve=>server.close(resolve));
    }
  });
function documentedStatus(text){return /Nicht beurteilbar/i.test(text);}

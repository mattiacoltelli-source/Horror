import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tools/nun/review'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':393,'height':852},device_scale_factor=1,is_mobile=True,has_touch=True,service_workers='block')
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://127.0.0.1:8765/agnese-preview.html')
  await page.wait_for_function("window.__agneseReview?.model",timeout=60000)
  await page.screenshot(path=str(OUT/'mobile-new.png'))
  await page.get_by_role('button',name='Viso',exact=True).click()
  await page.screenshot(path=str(OUT/'mobile-face.png'))
  metrics=await page.evaluate("""()=>{const r=__agneseReview;return {triangles:r.renderer.info.render.triangles,calls:r.renderer.info.render.calls,textures:r.renderer.info.memory.textures,skinned:(()=>{let found=false;r.model.traverse(c=>found ||= c.isSkinnedMesh);return found})(),clips:r.mixer._actions.map(a=>a.getClip().name)}}""")
  await page.get_by_role('button',name='Movimento della testa').click()
  await page.get_by_role('button',name='Originale',exact=True).click()
  await page.wait_for_function("document.querySelector('#status').textContent==='Modello originale'")
  await page.screenshot(path=str(OUT/'mobile-original-face.png'))
  await page.get_by_role('button',name='Nuova',exact=True).click()
  await page.wait_for_function("document.querySelector('#status').textContent.includes('12 ossa')")
  height=await page.evaluate("__agneseReview.model.scale.x")
  results={'preview':metrics,'reselectedScale':height,'errors':errors.copy()}
  for turned in (0,1):
   await page.goto(f'http://127.0.0.1:8765/index.html?start=torre&debug=1&turned={turned}')
   await page.locator('#enter').wait_for(state='visible')
   await page.wait_for_function("!document.querySelector('#enter').disabled",timeout=60000)
   await page.locator('#enter').click()
   await page.wait_for_function("window.__g?.scare?.ready",timeout=60000)
   await page.wait_for_function("parseFloat(getComputedStyle(document.querySelector('#fade')).opacity)<0.01",timeout=30000)
   await page.evaluate("__g.hold=true")
   result=await page.evaluate("""turned=>{const g=__g,s=g.scare; const kind=turned?'behind':'ahead';s.trigger(kind,'prova');s.update(1.06);g.lights.update(.016,1,g.player.pos.z,g.player.pos.x);g.renderer.render(g.scene,g.camera);return {ready:s.ready,kind:s.kind,fired:s.fired,model:s.model.name,drawCalls:g.renderer.info.render.calls}}""",turned)
   await page.screenshot(path=str(OUT/f'finale-{turned}.png'))
   await page.evaluate("__g.scare.update(2)")
   result['finished']=await page.evaluate("__g.scare.done===true && __g.scare.ent.visible===false")
   assert result['ready'] and result['fired'] and result['finished'], result
   results[f'finale-{turned}']=result
  results['errors']=errors
  assert not errors, errors
  assert metrics['calls']==1 and metrics['skinned'], metrics
  (OUT/'browser-checks.json').write_text(json.dumps(results,indent=2))
  print(json.dumps(results,indent=2))
  await browser.close()
asyncio.run(main())

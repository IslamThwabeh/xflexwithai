// Local browser regression checks for the homepage QA fixes. All API data is synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.HOME_QA_BASE_URL || 'http://127.0.0.1:4173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local frontend server');
const out = 'output/playwright/homeqa-fixed';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ reducedMotion: 'reduce' });
const checks = [];
const pageErrors = [];
const unknownQueries = new Set();
let articleState = 'ready';
let liveState = 'open';
let delayArticles = false;
const articles = [
  { id: -1, slug: 'qa-bilingual-article', titleEn: 'Learning and risk management', titleAr: 'التعلم وإدارة المخاطر', subjectEn: 'Education', subjectAr: 'التعليم', contentEn: 'Local QA article.', contentAr: 'مقال اختبار محلي.', excerptEn: 'Learn with structure.', excerptAr: 'تعلم بمنهج منظم.', isPublished: true, languageAvailability: 'both', publishedAt: '2026-11-01T12:00:00Z', createdAt: '2026-11-01T12:00:00Z', updatedAt: '2026-11-01T12:00:00Z' },
  { id: -2, slug: 'qa-arabic-only', titleEn: 'Arabic-only article', titleAr: 'مقال بالعربية فقط', languageAvailability: 'ar', isPublished: true },
];

await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.pathname.includes('/api/trpc/')) {
    assert.equal(route.request().method(), 'GET', 'Browser QA must not submit API mutations');
    const names = decodeURIComponent(url.pathname.split('/api/trpc/')[1]).split(',');
    const inputs = JSON.parse(url.searchParams.get('input') || '{}');
    if (delayArticles && names.includes('articles.list')) await new Promise(resolve => setTimeout(resolve, 1500));
    const responses = names.map((name, index) => {
      let data;
      switch (name) {
        case 'auth.me': data = null; break;
        case 'auth.isAdmin': data = false; break;
        case 'packages.livePublicState': data = { visible: liveState !== 'hidden', purchasable: liveState === 'open', cohortStatus: liveState === 'completed' ? 'completed' : 'upcoming', nameEn: 'Live Package', nameAr: 'بكج لايف', price: 200000 }; break;
        case 'articles.list': data = articleState === 'empty' ? [] : articles; break;
        case 'articles.bySlug': data = articles[0]; break;
        case 'packages.bySlug': {
          const slug = inputs[index]?.json?.slug || 'basic';
          data = { id: 1, slug, nameEn: slug === 'basic' ? 'Basic Package' : 'Comprehensive Package', nameAr: slug === 'basic' ? 'الباقة الأساسية' : 'الباقة الشاملة', price: 70000, renewalPrice: 17500, currency: 'ILS', descriptionEn: 'Local QA package', descriptionAr: 'باقة اختبار محلية' };
          break;
        }
        case 'packages.courses': case 'testimonials.listWithContext': case 'events.list': case 'courses.list': data = []; break;
        default: unknownQueries.add(name); data = null;
      }
      return { result: { data: { json: data } } };
    });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(responses) });
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
  return route.continue();
});

const page = await context.newPage();
page.on('pageerror', error => pageErrors.push(String(error)));
async function home(language = 'en') {
  await page.goto(`${base}/${language}`);
  await page.locator('.cin-home h1').waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.locator('.cin-home header img').evaluate(image => image.decode());
}
async function shot(name) {
  await page.evaluate(async () => {
    const visibleImages=[...document.images].filter(image=>{const rect=image.getBoundingClientRect();return rect.bottom>0 && rect.top<innerHeight && rect.width>0;});
    await Promise.all(visibleImages.map(image=>image.decode().catch(()=>{})));
  });
  await page.screenshot({ path: `${out}/${name}.png` });
}
function pass(name, details = {}) { checks.push({ name, status: 'pass', ...details }); console.log(`PASS ${name}`); }
function assertRectsFit(rects, width, label) {
  for (const rect of rects) assert(rect.x >= -1 && rect.x + rect.width <= width + 1, `${label}: ${JSON.stringify(rect)}`);
}

try {
  for (const language of ['en', 'ar']) {
    for (const [width, height] of [[320, 740], [390, 844], [667, 375], [768, 1024], [1024, 768], [1279, 900], [1280, 900], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await home(language);
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      const logo = await page.locator('.cin-home header img').boundingBox();
      assert(logo.width >= 150, `Readable logo width at ${width}`);
      const trigger = page.locator('header button[aria-controls="cin-home-mobile-menu"]');
      assert.equal(await page.locator('#cin-home-mobile-menu').count(),1,'Menu control always references an existing region');
      assert.equal(await trigger.isVisible(), width < 1280);
      if (width >= 1280) {
        const rects = await page.locator('header').evaluate(header => [...header.querySelectorAll('img, button')].map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, x: r.x, width: r.width }; }).filter(r => r.width));
        assertRectsFit(rects, width, 'Desktop header');
        const mainChildren = await page.locator('header .container').evaluate(e => [...e.children].map(n => { const r=n.getBoundingClientRect(); return { x:r.x, width:r.width }; }).filter(r=>r.width).sort((a,b)=>a.x-b.x));
        for (let i=1;i<mainChildren.length;i++) assert(mainChildren[i].x >= mainChildren[i-1].x + mainChildren[i-1].width - 1, 'Header groups must not overlap');
      } else {
        await trigger.click();
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        assert.equal(await trigger.getAttribute('aria-label'), language === 'ar' ? 'إغلاق القائمة' : 'Close menu');
        const menu = page.locator('#cin-home-mobile-menu');
        await menu.evaluate(e => { e.scrollTop = e.scrollHeight; });
        const action = menu.getByRole('button', { name: language === 'ar' ? 'ابدأ الآن' : 'Get Started', exact: true });
        const actionRect = await action.boundingBox();
        assert(actionRect.y >= 0 && actionRect.y + actionRect.height <= height + 1, 'Landscape action reachable inside menu');
        await shot(`${language}-${width}-menu`);
        await page.keyboard.press('Escape');
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
        assert(await trigger.evaluate(e => e === document.activeElement), 'Escape restores trigger focus');
      }
      await shot(`${language}-${width}-top`);
      if (width <= 390) {
        const card = page.locator('#packages article').first();
        await card.scrollIntoViewIfNeeded();
        // Inspect actual text lines: ghost-button pseudo-elements intentionally overflow
        // their scroll boxes, particularly in RTL, without clipping the label.
        const collisions = await card.evaluate(card => {
          const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);const failures=[];
          while(walker.nextNode()) {
            const text=walker.currentNode;if(!text.textContent.trim())continue;
            const container=text.parentElement.closest('.rounded-xl') || card;
            const bounds=container.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(text);
            for(const line of range.getClientRects())if(line.left<bounds.left-2 || line.right>bounds.right+2)failures.push({text:text.textContent,x:line.x,width:line.width,containerWidth:bounds.width});
          }
          return failures;
        });
        assert.deepEqual(collisions, [], 'No clipped pricing text');
        await shot(`${language}-${width}-pricing`);
      }
      await page.locator('footer').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await shot(`${language}-${width}-footer`);
      pass(`${language} responsive ${width}x${height}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await home(language);
    const footerPaths = await page.locator('footer a[href^="/"]').evaluateAll(links => links.map(a => a.getAttribute('href')));
    assert.equal(footerPaths.length, 9);
    for (const href of footerPaths) {
      assert(href === `/${language}` || href.startsWith(`/${language}/`), `Localized footer href ${href}`);
      await home(language);
      await page.locator(`footer a[href="${href}"]`).click();
      await page.waitForURL(url => url.pathname === href);
      assert.equal(await page.locator('html').getAttribute('lang'), language);
    }
    await home(language);
    const articleLinks = await page.locator('.cin-home a[href*="/articles/qa-"]').evaluateAll(links => links.map(a=>a.getAttribute('href')));
    assert.equal(articleLinks.length, language === 'ar' ? 2 : 1, 'Article language filtering');
    await page.locator(`a[href="/${language}/articles/qa-bilingual-article"]`).click();
    await page.waitForURL(`**/${language}/articles/qa-bilingual-article`);
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    await home(language);
    await page.getByRole('link', { name: language === 'ar' ? 'تواصل معنا' : 'Contact us', exact: true }).first().click();
    await page.waitForURL(`**/${language}/contact`);
    pass(`${language} footer, article and main Contact destinations`);

    await home(language);
    await page.locator('#faq summary').nth(3).click();
    await page.locator('#faq summary').nth(5).click();
    const faq = await page.locator('#faq').innerText();
    assert(faq.includes(language === 'ar' ? 'إيزي لايف' : 'Easy Life'));
    assert(faq.includes(language === 'ar' ? 'بتوقيت فلسطين' : 'Palestine time'));
    assert(!faq.includes(language === 'ar' ? 'متاح يومياً' : 'available daily'));
    const text=await page.locator('.cin-home').innerText();
    assert(!/Instant activation|human proof point|long content hub|تفعيل فوري/.test(text));
    await shot(`${language}-faq`);
    pass(`${language} corrected copy and expandable FAQs`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await home('en');
  const noAnimations = async () => assert.equal(await page.evaluate(() => document.getAnimations().filter(a=>a.playState==='running').length), 0);
  await noAnimations();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  await noAnimations();
  assert.equal(await page.getByRole('button', { name: 'Resume animations' }).getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(250);
  await noAnimations();
  await page.getByRole('button', { name: 'Resume animations' }).click();
  assert(await page.evaluate(() => document.getAnimations().some(a=>a.playState==='running')));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await noAnimations();
  const unrevealed = await page.locator('[data-reveal]').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).opacity==='0').length);
  assert.equal(unrevealed, 0);
  pass('Reduced motion, pause/resume and dynamic preference changes');

  const contrast = await page.evaluate(() => {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
    const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05);};
    const composite=(color,bg)=>{ctx.fillStyle=bg;ctx.fillRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const footer=[...document.querySelectorAll('footer p, footer a')].filter(n=>n.textContent.trim()).map(n=>({text:n.textContent,ratio:ratio(composite(getComputedStyle(n).color,'#050505'),[5,5,5])}));
    const buttons=[...document.querySelectorAll('.cin-btn-green')].map(n=>{const rgb=composite(getComputedStyle(n).color,'#00D17F');return {text:n.textContent,light:ratio(rgb,[0,209,127]),dark:ratio(rgb,[0,158,99])};});
    return {footer,buttons};
  });
  for(const item of contrast.footer)assert(item.ratio>=4.5,`Footer contrast ${item.text}: ${item.ratio}`);
  for(const item of contrast.buttons)assert(Math.min(item.light,item.dark)>=4.5,`CTA contrast ${item.text}`);
  await fs.writeFile(`${out}/contrast.json`,JSON.stringify(contrast,null,2));
  const cta=page.getByRole('button',{name:'Get Started',exact:true});
  await page.keyboard.press('Tab');
  await cta.focus();
  assert(await cta.evaluate(n=>n.matches(':focus-visible')),'Verify the keyboard focus modality');
  assert.notEqual(await cta.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  await shot('en-desktop-focus');
  const ctaColor=await cta.evaluate(n=>getComputedStyle(n).color);
  await cta.hover();
  assert.equal(await cta.evaluate(n=>getComputedStyle(n).color),ctaColor,'Hover keeps readable CTA label');
  await page.mouse.down();
  assert.equal(await cta.evaluate(n=>getComputedStyle(n).color),ctaColor,'Active keeps readable CTA label');
  await page.mouse.up();
  pass('Footer/CTA contrast and keyboard focus indicator');

  await home('en');
  const alpha=await page.locator('.cin-home header img').evaluate(image=>{
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    return [[0,0],[canvas.width-1,0],[0,canvas.height-1],[canvas.width-1,canvas.height-1]].map(([x,y])=>ctx.getImageData(x,y,1,1).data[3]);
  });
  assert.deepEqual(alpha,[0,0,0,0],'Logo background is genuine transparency');
  pass('Logo transparency (all four image corners)');

  await page.goto(`${base}/en?qa=language#faq`);
  await page.locator('.cin-home').waitFor();
  await page.locator('header').getByRole('button',{name:'العربية',exact:true}).click();
  await page.waitForURL(`${base}/ar?qa=language#faq`);
  assert.equal(await page.locator('html').getAttribute('lang'),'ar');
  await page.setViewportSize({width:667,height:375});await home('en');
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.locator('#cin-home-mobile-menu').getByRole('button',{name:'FAQ',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Open menu'}).getAttribute('aria-expanded'),'false');
  const faqTop=await page.locator('#faq').evaluate(n=>n.getBoundingClientRect().top);
  assert(faqTop>=60 && faqTop<=90,`FAQ anchor offset ${faqTop}`);
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>document.querySelector('button[aria-controls="cin-home-mobile-menu"]').getAttribute('aria-expanded')==='false');
  pass('Language switch keeps query/anchor; menu selection and desktop resize close the menu');

  await page.setViewportSize({width:1440,height:900});
  articleState='empty';liveState='hidden';await home('en');
  assert.equal(await page.locator('.cin-home a[href*="/articles/qa-"]').count(),0);
  assert.equal(await page.locator('.cin-home a[href$="/packages/live-package"]').count(),0);
  await shot('en-empty-articles-hidden-live');
  articleState='ready';liveState='completed';await home('en');
  assert(await page.getByText('Registration closed',{exact:true}).isVisible());
  liveState='open';delayArticles=true;await home('en');
  assert.equal(await page.locator('.cin-home .h-14.animate-pulse').count(),2,'Article loading placeholders are present');
  await page.locator('.cin-home a[href*="/articles/qa-bilingual"]').waitFor();
  pass('Empty/loading articles and hidden/closed/open Live fixtures');

  // Equivalent to a 1440px display at 200% page zoom: a 720 CSS-pixel viewport.
  await page.setViewportSize({width:720,height:450});await home('en');
  assert(await page.getByRole('button',{name:'Open menu'}).isVisible());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await shot('en-200-percent-reflow-equivalent');
  pass('200% zoom-equivalent responsive reflow (720 CSS pixels)');
  assert.deepEqual(pageErrors,[],'No browser JavaScript errors');
  pass('No browser JavaScript exceptions');
} finally {
  await fs.writeFile(`${out}/results.json`,JSON.stringify({base,checks,pageErrors,unknownQueries:[...unknownQueries],fixtures:'Synthetic public data; no real account or order',limitations:['Chrome emulation, not physical phones/Safari','200% zoom uses equivalent CSS viewport reflow']},null,2));
  await browser.close();
}

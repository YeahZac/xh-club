/** 小程序 web-view 内嵌底部操作栏（样式对齐 FixedBottomBar） */

export type MpToolbarKind = 'project' | 'event' | 'product'

export interface MpToolbarQuery {
  toolbar?: string
  has_scored?: string
  owner_id?: string
  title?: string
  registered?: string
  can_register?: string
  blocked?: string
  stock?: string
}

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const escapeJs = (value: string) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')

const TOOLBAR_STYLE = `
.xh-mp-toolbar{position:fixed;left:0;right:0;bottom:0;z-index:2147483646;display:flex;flex-direction:row;align-items:center;gap:12px;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));background:#ffffff;border-top:1px solid #EEF0F5;box-shadow:0 -6px 24px rgba(27,42,74,.08);box-sizing:border-box;}
.xh-mp-toolbar .xh-mp-btn{flex:1;min-width:0;height:44px;border-radius:16px;font-size:15px;font-weight:600;border:none;margin:0;padding:0 8px;line-height:44px;text-align:center;-webkit-appearance:none;appearance:none;}
.xh-mp-btn-gold{background:#C9A96E;color:#fff;}
.xh-mp-btn-brand{background:#1B2A4A;color:#fff;}
.xh-mp-btn-outline{background:#fff;color:#1B2A4A;border:1px solid #EEF0F5 !important;}
.xh-mp-btn-secondary{background:#F7F8FC;color:#1B2A4A;}
.xh-mp-btn-disabled{opacity:.85;background:#EEF0F5 !important;color:#98A2B3 !important;border-color:#EEF0F5 !important;}
html.xh-has-mp-toolbar,body.xh-has-mp-toolbar{padding-bottom:88px !important;box-sizing:border-box;}
`

const BRIDGE_SCRIPT = `
(function(){
  function toast(msg){
    try{
      if(typeof wx!=='undefined' && wx.showToast){wx.showToast({title:String(msg||''),icon:'none'});return;}
    }catch(e){}
    alert(String(msg||''));
  }
  function go(url, mode){
    if(!url){return;}
    try{
      if(typeof wx!=='undefined' && wx.miniProgram){
        var api = mode === 'redirect' && typeof wx.miniProgram.redirectTo === 'function'
          ? wx.miniProgram.redirectTo
          : wx.miniProgram.navigateTo;
        if(typeof api === 'function'){
          api.call(wx.miniProgram, {
            url:url,
            fail:function(){
              try{
                if(mode !== 'redirect' && typeof wx.miniProgram.redirectTo === 'function'){
                  wx.miniProgram.redirectTo({url:url});
                }else if(typeof wx.miniProgram.navigateTo === 'function'){
                  wx.miniProgram.navigateTo({url:url});
                }
              }catch(e2){
                toast('请升级微信后重试');
              }
            }
          });
          return;
        }
      }
    }catch(e){}
    toast('请在星河俱乐部小程序中打开');
  }
  window.__xhMpGo=go;
  window.__xhMpToast=toast;
  document.documentElement.classList.add('xh-has-mp-toolbar');
  document.body.classList.add('xh-has-mp-toolbar');
})();
`

function projectToolbarHtml(id: string, q: MpToolbarQuery): string {
  const scored = String(q.has_scored || '') === '1'
  const scoreLabel = scored ? '已评分' : '评分'
  const title = escapeJs(String(q.title || ''))
  const ownerId = escapeJs(String(q.owner_id || ''))
  const scoreUrl = `/pages/project-score/index?projectId=${encodeURIComponent(id)}`
  const shareUrl = `/pages/project-share/index?projectId=${encodeURIComponent(id)}&title=${encodeURIComponent(String(q.title || ''))}`
  const dealUrl = `/pages/deal-applications/form/index?project_id=${encodeURIComponent(id)}${ownerId ? `&owner_member_id=${encodeURIComponent(String(q.owner_id || ''))}` : ''}${title ? `&project_title=${encodeURIComponent(String(q.title || ''))}` : ''}`

  return `
<div class="xh-mp-toolbar" role="navigation" aria-label="项目操作">
  <button type="button" class="xh-mp-btn xh-mp-btn-gold" onclick="window.__xhMpGo('${escapeJs(scoreUrl)}')">${escapeHtml(scoreLabel)}</button>
  <button type="button" class="xh-mp-btn xh-mp-btn-brand" onclick="window.__xhMpGo('${escapeJs(shareUrl)}')">分享</button>
  <button type="button" class="xh-mp-btn xh-mp-btn-outline" onclick="window.__xhMpGo('${escapeJs(dealUrl)}')">申请成交记录</button>
</div>`
}

function eventToolbarHtml(id: string, q: MpToolbarQuery): string {
  const registered = String(q.registered || '') === '1'
  const canRegister = String(q.can_register || '') === '1'
  const blocked = String(q.blocked || '暂不可报名')
  const registerUrl = `/pages/register/index?kind=event&id=${encodeURIComponent(id)}`

  if (registered) {
    return `
<div class="xh-mp-toolbar" role="navigation" aria-label="活动操作">
  <button type="button" class="xh-mp-btn xh-mp-btn-secondary xh-mp-btn-disabled" onclick="window.__xhMpToast('已报名')">已报名</button>
</div>`
  }
  if (canRegister) {
    return `
<div class="xh-mp-toolbar" role="navigation" aria-label="活动操作">
  <button type="button" class="xh-mp-btn xh-mp-btn-brand" onclick="window.__xhMpGo('${escapeJs(registerUrl)}')">立即报名</button>
</div>`
  }
  return `
<div class="xh-mp-toolbar" role="navigation" aria-label="活动操作">
  <button type="button" class="xh-mp-btn xh-mp-btn-secondary" onclick="window.__xhMpToast('${escapeJs(blocked)}')">${escapeHtml(blocked)}</button>
</div>`
}

function productToolbarHtml(id: string, q: MpToolbarQuery): string {
  const stock = Number(q.stock || 0)
  const soldOut = !(stock > 0)
  const cartUrl = `/pages/mall/product-detail/index?id=${encodeURIComponent(id)}&forceNative=1&action=cart`
  const buyUrl = `/pages/mall/product-detail/index?id=${encodeURIComponent(id)}&forceNative=1&action=buy`
  const buyLabel = soldOut ? '已售罄' : '立即兑换'

  return `
<div class="xh-mp-toolbar" role="navigation" aria-label="商品操作">
  <button type="button" class="xh-mp-btn xh-mp-btn-outline${soldOut ? ' xh-mp-btn-disabled' : ''}" ${soldOut ? `onclick="window.__xhMpToast('已售罄')"` : `onclick="window.__xhMpGo('${escapeJs(cartUrl)}','redirect')"`}>加入购物车</button>
  <button type="button" class="xh-mp-btn xh-mp-btn-brand${soldOut ? ' xh-mp-btn-disabled' : ''}" ${soldOut ? `onclick="window.__xhMpToast('已售罄')"` : `onclick="window.__xhMpGo('${escapeJs(buyUrl)}','redirect')"`}>${escapeHtml(buyLabel)}</button>
</div>`
}

/** 将小程序底栏注入完整 HTML 文档 */
export function injectMpToolbar(html: string, contentId: string, query: MpToolbarQuery): string {
  const kind = String(query.toolbar || '').trim() as MpToolbarKind
  if (!kind || !['project', 'event', 'product'].includes(kind)) return html
  const id = String(contentId || '').trim()
  if (!id) return html

  let bar = ''
  if (kind === 'project') bar = projectToolbarHtml(id, query)
  else if (kind === 'event') bar = eventToolbarHtml(id, query)
  else bar = productToolbarHtml(id, query)

  const injection = `<style id="xh-mp-toolbar-style">${TOOLBAR_STYLE}</style>${bar}<script id="xh-mp-toolbar-script">${BRIDGE_SCRIPT}</script>`

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${injection}</body>`)
  }
  return `${html}${injection}`
}

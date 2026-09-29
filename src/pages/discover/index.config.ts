export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '发现', navigationStyle: 'custom', enableShareAppMessage: true, enableShareTimeline: true })
  : { navigationBarTitleText: '发现', navigationStyle: 'custom', enableShareAppMessage: true, enableShareTimeline: true }

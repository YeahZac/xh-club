export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '消息', navigationStyle: 'custom' })
  : { navigationBarTitleText: '消息', navigationStyle: 'custom' }

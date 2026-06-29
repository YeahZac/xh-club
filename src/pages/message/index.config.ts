export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '消息' })
  : { navigationBarTitleText: '消息' }

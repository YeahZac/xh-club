export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '积分商城' })
  : { navigationBarTitleText: '积分商城' }

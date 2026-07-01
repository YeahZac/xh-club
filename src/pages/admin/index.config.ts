export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '报名管理后台', navigationBarBackgroundColor: '#1B2A4A', navigationBarTextStyle: 'white' })
  : { navigationBarTitleText: '报名管理后台', navigationBarBackgroundColor: '#1B2A4A', navigationBarTextStyle: 'white' }

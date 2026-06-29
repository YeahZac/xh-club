export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '上星河俱乐部',
      navigationStyle: 'custom',
      navigationBarBackgroundColor: '#FF2442',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '上星河俱乐部',
      navigationStyle: 'custom',
      navigationBarBackgroundColor: '#FF2442',
      navigationBarTextStyle: 'white',
    }

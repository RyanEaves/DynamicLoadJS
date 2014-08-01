# Parameters
- DynamicElementSelector
  - Default: `#dynamicContent`
  - Description: Used to specify the name of the container that will be swapped on dynamic load

        UseAPI: true,
        APIUrlSalt: '/api/contentfilter/',
        CallbackBeforeLoad: $.noop,
        CallbackAfterLoadSuccess: $.noop,
        CallbackAfterLoadFail: $.noop,
        CallbackAfterLoadAlways: $.noop,
        HttpHeaderNameDynamicElementSelector: 'X-DynamicLoad-Element-Selector',
        HttpHeaderNamePageTitle: 'X-Page-Title',
        SkipDynamicLoadSelector: '.SkipDynamicLoad'
var DynamicLoad = {
    PushStateSupport: false,
    BaseUrl: window.location.pathname,
    CallbackAfterContentInjectDeclared: false,
    options: {
        DynamicElementSelector: '#dynamicContent',
        UseAPI: true,
        APIUrlSalt: '/api/contentfilter/',
        CallbackBeforeLoad: $.noop,
        CallbackAfterContentInject: $.noop,
        CallbackAfterLoadSuccess: $.noop,
        CallbackAfterLoadFail: $.noop,
        CallbackAfterLoadAlways: $.noop,
        HttpHeaderNameDynamicElementSelector: 'X-DynamicLoad-Element-Selector',
        HttpHeaderNamePageTitle: 'X-Page-Title',
        SkipDynamicLoadSelector: '.SkipDynamicLoad'
    },

    init: function (settings) {
        var context = this;
        //Integrate options
        if (typeof settings.DynamicElementSelector !== 'undefined')
            this.options.DynamicElementSelector = settings.DynamicElementSelector;
        if (typeof settings.UseAPI !== 'undefined')
            this.options.UseAPI = settings.UseAPI;
        if (typeof settings.CallbackBeforeLoad === 'function' && settings.CallbackBeforeLoad())
            this.options.CallbackBeforeLoad = settings.CallbackBeforeLoad;
        if (typeof settings.CallbackAfterContentInject === 'function' && settings.CallbackAfterContentInject()) {
            this.options.CallbackAfterContentInject = settings.CallbackAfterContentInject;
            this.CallbackAfterContentInjectDeclared = true;
        }
        if (typeof settings.CallbackAfterLoadSuccess === 'function' && settings.CallbackAfterLoadSuccess())
            this.options.CallbackAfterLoadSuccess = settings.CallbackAfterLoadSuccess;
        if (typeof settings.CallbackAfterLoadFail === 'function' && settings.CallbackAfterLoadFail())
            this.options.CallbackAfterLoadFail = settings.CallbackAfterLoadFail;
        if (typeof settings.CallbackAfterLoadAlways === 'function' && settings.CallbackAfterLoadAlways())
            this.options.CallbackAfterLoadAlways = settings.CallbackAfterLoadAlways;
        if (typeof settings.HttpHeaderNameDynamicElementSelector !== 'undefined')
            this.options.HttpHeaderNameDynamicElementSelector = settings.HttpHeaderNameDynamicElementSelector;
        if (typeof settings.HttpHeaderNamePageTitle !== 'undefined')
            this.options.HttpHeaderNamePageTitle = settings.HttpHeaderNamePageTitle;
        if (typeof settings.SkipLinkSelector !== 'undefined')
            this.options.SkipLinkSelector = settings.SkipLinkSelector;

        //Init Global Variables
        PushStateSupport = !!(window.history && history.pushState); //Detect whether browser supports pushState
        SkipDynamicLoadOnce = false;
        BaseUrl = window.location.pathname;

        //Perform initial tasks
        if (PushStateSupport == true) {
            //Hijack anchors
            this.overrideAnchors();

            //Bind statechange
            History.Adapter.bind(window, 'statechange', function () {
                context.loadContent(context)
            });
        }

        return this;
    },

    //Hijack all internal anchors to load dynamic content instead of page load
    overrideAnchors: function () {
        //Internal Link Anchor Tags
        $('a[href^="/"]:not(' + this.options.SkipLinkSelector + ')').addClass('dynamicLoadInternalLink');
        $(document).off('click.dynamicLoad.internalLink').on('click.dynamicLoad.internalLink', 'a[href^="/"]:not(' + this.options.SkipLinkSelector + ')', function (event) {
            if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                event.preventDefault();
                var url = $(event.currentTarget).attr('href');
                History.pushState({ url: url }, null, url);
            }
        });
    },

    //Use Ajax to communicate with the server and retrieve next content
    loadContent: function (context) {
        var State = History.getState();

        var $dynamicContent;
        var loadUrl = (context.options.UseAPI) ?
            (
                (State.data.url != "/") ?
                    context.options.APIUrlSalt + State.data.url.substring(1, State.data.url.length) :
                    context.options.APIUrlSalt + "home"
            ) :
            State.url;

        context.options.CallbackBeforeLoad.call(context, State.data.url);
        $.ajax({
            url: loadUrl,
            dataType: 'html',
            beforeSend: function (jqXHR, settings) {
                jqXHR.setRequestHeader(
                    context.options.HttpHeaderNameDynamicElementSelector,
                    context.options.dynamicElementSelector
                );
            },
            success: function (data, textStatus, jqXHR) {
                //Workaround to prevent jQuery from removing script tags from response
                var tempScriptTag = 'scripthack' + Math.floor((Math.random() * 100000) + 1); //Use a random number in the temp script tag to prevent injection of 'scripthack' tags
                var response = data.replace(/(<script )((.|\s)*?)(<\/script>)/ig, '<' + tempScriptTag + ' $2</' + tempScriptTag + '>');
                console.log(response);
                //load the response DOM
                var $response = $(response);
                //Update the title tag
                document.title = (context.options.UseAPI) ?
                    jqXHR.getResponseHeader(context.options.HttpHeaderNamePageTitle) :
                    $response.filter('title').text();
                //Capture content
                if (context.options.UseAPI) {
                    $dynamicContent = $response;
                }
                else {
                    $dynamicContent = $response.find(context.options.DynamicElementSelector);
                }
                //If the html did not come down the pipe for some reason, i.e. error page
                if ($dynamicContent.length == 0) {
                    console.log('Loaded content not dynamic, try again.');
                }
                //Capture scripts
                var $scripts = $dynamicContent.find(tempScriptTag);
                //Remove scripthack from DOM
                $dynamicContent.find(tempScriptTag).remove();
                //Inject html
                if (context.CallbackAfterContentInjectDeclared == true) {
                    $dynamicContent.hide();
                    $dynamicContent.insertAfter($(context.options.DynamicElementSelector));
                    context.options.CallbackAfterContentInject.call(
                        context,
                        State.data.url,
                        $(context.options.DynamicElementSelector),
                        $dynamicContent,
                        function () {
                            $(context.options.DynamicElementSelector).remove();
                            $dynamicContent.show();
                            context._completeLoad(
                                context,
                                State.data.url,
                                $scripts,
                                tempScriptTag
                            );
                        });
                }
                else {
                    $(context.options.DynamicElementSelector).html($dynamicContent.html());
                    context._completeLoad(
                            context,
                            State.data.url,
                            $scripts,
                            tempScriptTag
                        );
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log('There was an error loading the page [' + textStatus + '] Message: ' + errorThrown);
                context.options.CallbackAfterLoadFail.call(context, State.data.url);
            },
            complete: function (jqXHR, textStatus) {
                context.options.CallbackAfterLoadAlways.call(context, State.data.url);
            }
        });
    },

    _completeLoad: function (context, url, $scripts, tempScriptTag) {
        //Execute Scripts
        $.each($scripts, function (index, script) {
            //Load inline and external scripts
            var jsUrl = $(script).attr('src');
            var scriptType = $(script).attr('type');

            if (scriptType == 'text/html') { //inject script MVVM templates
                var regEx = new RegExp('(<' + tempScriptTag + ')((.|\\s)*?)(<\/' + tempScriptTag + '>)', 'ig');
                var scriptString = $(script).wrap('<div></div>').parent().html()
                    .replace(regEx, '<script$2</script>');
                $(context.options.DynamicElementSelector).append(scriptString);
            }
            else if (jsUrl == null) { $.globalEval($(script).text()); } // Execute inline scripts
            else if (jsUrl != null) { $.getScript(jsUrl, function (data, textStatus, jqxhr) { }); } //Load extenal scripts
        });
        context.overrideAnchors();
        context.options.CallbackAfterLoadSuccess.call(context, url);
    }
};

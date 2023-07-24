var _a, _b;
import { debounce, getDocument, getClientId, getSessionId, getSessionState, getScrollPercentage, getRandomId, isTargetElement, getUrlData, getEventParams, } from '@minimal-analytics/shared';
import { param, files } from './model';
/* -----------------------------------
 *
 * Variables
 *
 * -------------------------------- */
const isBrowser = typeof window !== 'undefined';
const defineGlobal = isBrowser && ((_a = window.minimalAnalytics) === null || _a === void 0 ? void 0 : _a.defineGlobal);
const autoTrack = isBrowser && ((_b = window.minimalAnalytics) === null || _b === void 0 ? void 0 : _b.autoTrack);
const analyticsEndpoint = 'https://www.google-analytics.com/g/collect';
const searchTerms = ['q', 's', 'search', 'query', 'keyword'];
const clickTargets = 'a, button, input[type=submit], input[type=button]';
let clickHandler;
let scrollHandler;
let unloadHandler;
let engagementTimes = [[Date.now()]];
let trackCalled = false;
/* -----------------------------------
 *
 * Events
 *
 * -------------------------------- */
const eventKeys = {
    pageView: 'page_view',
    scroll: 'scroll',
    click: 'click',
    viewSearchResults: 'view_search_results',
    userEngagement: 'user_engagement',
    fileDownload: 'file_download',
};
/* -----------------------------------
 *
 * Arguments
 *
 * -------------------------------- */
function getArguments(args) {
    var _a;
    const globalId = (_a = window.minimalAnalytics) === null || _a === void 0 ? void 0 : _a.trackingId;
    const trackingId = typeof args[0] === 'string' ? args[0] : globalId;
    const props = typeof args[0] === 'object' ? args[0] : args[1] || {};
    return [trackingId, Object.assign({ type: eventKeys.pageView }, props)];
}
/* -----------------------------------
 *
 * EventMeta
 *
 * -------------------------------- */
function getEventMeta({ type = '', event }) {
    const searchString = document.location.search;
    const searchParams = new URLSearchParams(searchString);
    const searchResults = searchTerms.some((term) => new RegExp(`[\?|&]${term}=`, 'g').test(searchString));
    const eventName = searchResults ? eventKeys.viewSearchResults : type;
    const searchTerm = searchTerms.find((term) => searchParams.get(term));
    let eventParams = [
        [param.eventName, eventName],
        [`${param.eventParam}.search_term`, searchTerm || ''],
    ];
    if (event) {
        eventParams = eventParams.concat(getEventParams(event));
    }
    return eventParams;
}
/* -----------------------------------
 *
 * Query
 *
 * -------------------------------- */
function getQueryParams(trackingId, { type, event, debug }) {
    const { location, referrer, title } = getDocument();
    const { firstVisit, sessionStart, sessionCount } = getSessionState(!trackCalled);
    const screen = self.screen || {};
    let params = [
        [param.protocolVersion, '2'],
        [param.trackingId, trackingId],
        [param.pageId, getRandomId()],
        [param.language, (navigator.language || '').toLowerCase()],
        [param.clientId, getClientId()],
        [param.firstVisit, firstVisit],
        [param.hitCount, '1'],
        [param.sessionId, getSessionId()],
        [param.sessionCount, sessionCount],
        [param.sessionEngagement, '1'],
        [param.sessionStart, sessionStart],
        [param.debug, debug ? '1' : ''],
        [param.referrer, referrer],
        [param.location, location],
        [param.title, title],
        [param.screenResolution, `${screen.width}x${screen.height}`],
    ];
    params = params.concat(getEventMeta({ type, event }));
    params = params.filter(([, value]) => value);
    return new URLSearchParams(params);
}
/* -----------------------------------
 *
 * ActiveTime
 *
 * -------------------------------- */
function getActiveTime() {
    const timeActive = engagementTimes
        .reduce((result, [visible, hidden = Date.now()]) => (result += hidden - visible), 0)
        .toString();
    return timeActive;
}
/* -----------------------------------
 *
 * ClickEvent
 *
 * -------------------------------- */
function onClickEvent(trackingId, event) {
    var _a, _b, _c, _d;
    const targetElement = isTargetElement(event.target, clickTargets);
    const tagName = (_a = targetElement === null || targetElement === void 0 ? void 0 : targetElement.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    const elementType = tagName === 'a' ? 'link' : tagName;
    const hrefAttr = (targetElement === null || targetElement === void 0 ? void 0 : targetElement.getAttribute('href')) || void 0;
    const downloadAttr = (targetElement === null || targetElement === void 0 ? void 0 : targetElement.getAttribute('download')) || void 0;
    const fileUrl = downloadAttr || hrefAttr;
    const { isExternal, hostname, pathname } = getUrlData(fileUrl);
    const isInternalLink = elementType === 'link' && !isExternal;
    const [fileExtension] = (fileUrl === null || fileUrl === void 0 ? void 0 : fileUrl.match(new RegExp(files.join('|'), 'g'))) || [];
    const eventName = fileExtension ? eventKeys.fileDownload : eventKeys.click;
    const elementParam = `${param.eventParam}.${elementType}`;
    if (!targetElement || (isInternalLink && !fileExtension)) {
        return;
    }
    let eventParams = [
        [`${elementParam}_id`, targetElement.id],
        [`${elementParam}_classes`, targetElement.className],
        [`${elementParam}_name`, (_b = targetElement === null || targetElement === void 0 ? void 0 : targetElement.getAttribute('name')) === null || _b === void 0 ? void 0 : _b.trim()],
        [`${elementParam}_text`, (_c = targetElement.textContent) === null || _c === void 0 ? void 0 : _c.trim()],
        [`${elementParam}_value`, (_d = targetElement === null || targetElement === void 0 ? void 0 : targetElement.getAttribute('value')) === null || _d === void 0 ? void 0 : _d.trim()],
        [`${elementParam}_url`, hrefAttr],
        [`${elementParam}_domain`, hostname],
        [`${param.eventParam}.outbound`, `${isExternal}`],
        [param.enagementTime, getActiveTime()],
    ];
    if (fileExtension) {
        eventParams = eventParams.concat([
            [`${param.eventParam}.file_name`, pathname || fileUrl],
            [`${param.eventParam}.file_extension`, fileExtension],
        ]);
    }
    track(trackingId, {
        type: eventName,
        event: eventParams,
    });
}
/* -----------------------------------
 *
 * BlurEvent
 *
 * -------------------------------- */
function onBlurEvent() {
    const timeIndex = engagementTimes.length - 1;
    const [, isHidden] = engagementTimes[timeIndex];
    if (!isHidden) {
        engagementTimes[timeIndex].push(Date.now());
    }
}
/* -----------------------------------
 *
 * FocusEvent
 *
 * -------------------------------- */
function onFocusEvent() {
    const timeIndex = engagementTimes.length - 1;
    const [, isHidden] = engagementTimes[timeIndex];
    if (isHidden) {
        engagementTimes.push([Date.now()]);
    }
}
/* -----------------------------------
 *
 * VisibilityEvent
 *
 * -------------------------------- */
function onVisibilityChange() {
    const timeIndex = engagementTimes.length - 1;
    const [, isHidden] = engagementTimes[timeIndex];
    const stateIndex = ['hidden', 'visible'].indexOf(document.visibilityState);
    const isVisible = Boolean(stateIndex);
    if (stateIndex === -1) {
        return;
    }
    if (!isVisible) {
        !isHidden && engagementTimes[timeIndex].push(Date.now());
        return;
    }
    isHidden && engagementTimes.push([Date.now()]);
}
/* -----------------------------------
 *
 * ScrollEvent
 *
 * -------------------------------- */
const onScrollEvent = debounce((trackingId) => {
    const percentage = getScrollPercentage();
    if (percentage < 90) {
        return;
    }
    const eventParams = [[`${param.eventParamNumber}.percent_scrolled`, 90]];
    track(trackingId, {
        type: eventKeys.scroll,
        event: eventParams,
    });
    document.removeEventListener('scroll', scrollHandler);
});
/* -----------------------------------
 *
 * UnloadEvent
 *
 * -------------------------------- */
function onUnloadEvent(trackingId) {
    const eventParams = [[param.enagementTime, getActiveTime()]];
    track(trackingId, {
        type: eventKeys.userEngagement,
        event: eventParams,
    });
}
/* -----------------------------------
 *
 * BindEvent
 *
 * -------------------------------- */
function bindEvents(trackingId) {
    if (trackCalled) {
        return;
    }
    clickHandler = onClickEvent.bind(null, trackingId);
    scrollHandler = onScrollEvent.bind(null, trackingId);
    unloadHandler = onUnloadEvent.bind(null, trackingId);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('scroll', scrollHandler);
    document.addEventListener('click', clickHandler);
    window.addEventListener('blur', onBlurEvent);
    window.addEventListener('focus', onFocusEvent);
    window.addEventListener('beforeunload', unloadHandler);
}
function track(...args) {
    var _a;
    const [trackingId, { type, event, debug }] = getArguments(args);
    if (!trackingId) {
        console.error('GA4: Tracking ID is missing or undefined');
        return;
    }
    const queryParams = getQueryParams(trackingId, { type, event, debug });
    const endpoint = ((_a = window.minimalAnalytics) === null || _a === void 0 ? void 0 : _a.analyticsEndpoint) || analyticsEndpoint;
    navigator.sendBeacon(`${endpoint}?${queryParams}`);
    bindEvents(trackingId);
    trackCalled = true;
}
/* -----------------------------------
 *
 * Define
 *
 * -------------------------------- */
if (defineGlobal) {
    window.track = track;
}
/* -----------------------------------
 *
 * Init
 *
 * -------------------------------- */
if (autoTrack) {
    track();
}
/* -----------------------------------
 *
 * Export
 *
 * -------------------------------- */
export { track };


(function background() {

    // Time Management
    const MINUTE = 60 * 1000;
    const HOUR = MINUTE * 60;
    const formatDate = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    let currentDate = formatDate(new Date());
    setInterval(() => currentDate = formatDate(new Date()), 5 * MINUTE);

    // Defining Patterns and policies
    let limits = {};
    
    const updatePolicies = () => chrome.storage.sync.get(['policies'], response => {
        const policies = response.policies;
        limits = {};
        policies.forEach(policy => {
            limits[policy.url] = HOUR * policy.limit;
        });
        removeUnwatchedTabs();
        console.log("Policies loaded", limits);
    });

    updatePolicies();
    setInterval(updatePolicies, MINUTE);

    chrome.extension.onRequest.addListener(request => {
        if (request.action === "reload-policies") {
            updatePolicies();
        }
    });

    const getPatternForUrl = url => Object.keys(limits).find(pattern => new RegExp(pattern).test(url));

    const blockTab = (tabId, blockedUrl) => {
        const baseUrl = chrome.extension.getURL("blocked.html");
        chrome.tabs.update(tabId, {url: `${baseUrl}?url=${blockedUrl}`});;
        tabsOnPagesUnderWatch[tabId] = null;
    };

    // Retrieving and updating cloud counts
    const getCloudUsages = () => new Promise(resolve => 
        chrome.storage.sync.get(['daily-usage'], response => {
            const data = response['daily-usage'];
            if (data.date !== currentDate) {
                return resolve({});
            } else {
                return resolve(data.usages);
            }
        })
    );
    const setCloudUsages = usages => new Promise(resolve => {
        console.log("New clound usage counts", usages);
        chrome.storage.sync.set({
            'daily-usage': {usages, date: currentDate}
        }, resolve);
    });

    // Count incrementing
    let usageCountCloud = {};
    let usageCountLocal = {};
    const shouldBlock = url => {
        const usedTime = 
            (usageCountCloud[url] ? usageCountCloud[url] : 0) + 
            (usageCountLocal[url] ? usageCountLocal[url] : 0);
        return (usedTime > limits[url]);
    }

    // Tracking active tab
    const activeTabs = {};
    chrome.tabs.onActivated.addListener(({tabId, windowId}) => activeTabs[windowId] = tabId);

    chrome.tabs.onRemoved.addListener(removedTabId => 
        Object.entries(activeTabs).forEach(([windowId, tabId]) => {
            if (removedTabId === tabId) {
                activeTabs[windowId] = null;
                console.log("Closed a tab", tabId);
            }
        })
    );

    // Tracking tab urls
    const tabsOnPagesUnderWatch = {};
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        const url = changeInfo.url
        if (url) {
            const urlUnderWatch = getPatternForUrl(url)
            if (urlUnderWatch) {
                tabsOnPagesUnderWatch[tabId] = urlUnderWatch;
                if (shouldBlock(urlUnderWatch)) {
                    console.log("Insta-block");
                    blockTab(tabId, urlUnderWatch);
                }
            } else {
                tabsOnPagesUnderWatch[tabId] = null;
            }
        }
    });
    const removeUnwatchedTabs = () => Object.entries(tabsOnPagesUnderWatch)
        .forEach(([tabId, url]) => {
            if (!getPatternForUrl(url)) {
                tabsOnPagesUnderWatch[tabId] = null;
            }
        });

    const CLOUD_REFRESH_INTERVAL = 10000;
    // Update the cloud to contain the proper counts
    setInterval(async () => {
        try {
            // Update local copy of cloud values
            usageCountCloud = await getCloudUsages();
            
            // Merge local and cloud copies
            if (Object.keys(usageCountLocal).length > 0) {
                Object.entries(usageCountLocal).forEach(([url, timeUsed]) => {
                    if (usageCountCloud[url]) {
                        usageCountCloud[url] += timeUsed;
                    } else {
                        usageCountCloud[url] = timeUsed;
                    }
                });
                // Push new cloud counts
                await setCloudUsages(usageCountCloud);
                usageCountLocal = {};
            }
        } catch (error) {
            console.error("Failed to update usage cloud", error);
        }
    }, CLOUD_REFRESH_INTERVAL);

    const incrementUsageCount = (url, refreshInterval) => {
        if (usageCountLocal[url]) {
            usageCountLocal[url] += refreshInterval;
        } else {
            usageCountLocal[url] = refreshInterval;
        }
    };

    // Checking for urls of interest in active tabs
    const LOCAL_REFRESH_INTERVAL = 2000;
    const syncCountsWithCloud = () => {
        // Find urls that should be increment
        const watchedUrlsOnActiveTabs = new Set();
        Object.values(activeTabs).forEach(activeTabId => {
            const urlUnderWatch = tabsOnPagesUnderWatch[activeTabId];
            if (urlUnderWatch) {
                watchedUrlsOnActiveTabs.add(urlUnderWatch);
            }
        });
        
        // Increment count of watched urls
        console.log("Urls being counted", watchedUrlsOnActiveTabs);
        watchedUrlsOnActiveTabs.forEach(url => incrementUsageCount(url, LOCAL_REFRESH_INTERVAL));
        
        // Block tabs that are beyond limit
        Object.values(activeTabs).forEach(activeTabId => {
            const url = tabsOnPagesUnderWatch[activeTabId];
            if (shouldBlock(url)) {
                blockTab(activeTabId, url);
            }
        });
    }
    syncCountsWithCloud();
    setInterval(syncCountsWithCloud, LOCAL_REFRESH_INTERVAL);
})();
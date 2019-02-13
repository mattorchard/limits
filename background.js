(function background() {
    'use strict';
    /*##### Intervals #####*/
    const SECOND = 1000;
    const MINUTE = 60 * SECOND;
    const HOUR = 60 * MINUTE;
    const UPDATE_POLICIES_INTERVAL = 10 * MINUTE;
    const SCAN_TABS_INTERVAL = 2.5 * SECOND;
    const SYNC_COUNTS_INTERVAL = 10 * SECOND;

    /*##### Local copies #####*/
    let policies = []; // Local policies
    let cloudUsages = {}; // Cloud usage counts
    let localUsages = {}; // Counts since last time cloud usages were updated


    const isToday = time => {
        const otherDate = new Date(time);
        const today = new Date();
        return today.toDateString() === otherDate.toDateString();
    }

    /*##### Policy Management #####*/

    // Fetches synced policies
    const getCloudPolicies = () => new Promise(resolve => 
        chrome.storage.sync.get(['policies'],
            response => resolve(response.policies))
    );
    
    // Update local copy of policies
    const updateLocalPolicies = async() => policies = await getCloudPolicies();

    /*##### Cloud Usage Count Management #####*/

    // Fetch cloud usages
    const getCloudUsages = () => new Promise(resolve => 
        chrome.storage.sync.get(['dailyUsages'], ({dailyUsages}) =>
            resolve(isToday(dailyUsages && dailyUsages.date) ? dailyUsages.usages : {}))
    );

    // Update cloud usages
    const setCloudUsages = usages => new Promise(resolve => 
        chrome.storage.sync.set({
            dailyUsages: {usages, date: Date.now()}
        }, resolve)
    );
    
    /*##### Counting and Blocking #####*/
    const getAllActiveTabs = () => new Promise(resolve => chrome.tabs.query({active: true}, resolve));

    const getPolicyMatchingUrl = url => {
        // Limits should never block local files (eg: file / chrome-extension)
        if (!url.startsWith("http")) {
            return null;
        }
        // Multiple policies may overlap, but only one will be incremented
        return policies.find(policy => {
            if (policy.regexFlag) {
                return new RegExp(policy.url).test(url);
            } else {
                return url.includes(policy.url);
            }
        });
    };

    // Send the user to the blocked page with the url being limited
    const blockTab = (tabId, blockedUrl) => {
        const baseUrl = chrome.extension.getURL("blocked.html");
        chrome.tabs.update(tabId, {
            url: `${baseUrl}?url=${blockedUrl}`
        });
    };

    const shouldBlock = ({limit, url}) => {
        // Convert the limit (given in hours) to milliseconds
        const timeAllowed =(limit) * HOUR;
        // If there is no data locally or in the local version of the cloud counts
        // then they have not used that url yet and we can assume time = 0
        const timeUsed = (localUsages[url] || 0) + (cloudUsages[url] || 0);

        return timeUsed >= timeAllowed;
    };

    // The local count increases by the amount of time between scans of tabs
    const increaseLocalUsageCount = url => {
        if (localUsages[url]) {
            localUsages[url] += SCAN_TABS_INTERVAL;
        } else {
            localUsages[url] = SCAN_TABS_INTERVAL;
        }
    }

    const scanTabsForLimitedUrls = async() => {
        // Inactive tabs are not considered against a users limit
        const activeTabs = await getAllActiveTabs();
        
        // Hashset to track what limits have already been counted in this interval
        const tabsOnLimitedUrls = new Set();

        activeTabs.forEach(({id, url}) => {
            const policy = getPolicyMatchingUrl(url);
            if (policy) {
                const blockedUrl = policy.url;
                // Increment the count for the url
                if (!tabsOnLimitedUrls.has(blockedUrl)) {
                    tabsOnLimitedUrls.add(blockedUrl);
                    increaseLocalUsageCount(blockedUrl);
                }
                console.table("New local usage counts", localUsages);
                if (shouldBlock(policy)) {
                    blockTab(id, blockedUrl);
                }
            }
        });
    };

    const synchronizeCounts = async() => {
        // Keep a reference to the local usage counts in case they are not able to be synced
        const localUsagesBackup = localUsages;
        try {            
            // Ensure local copy of cloud usage counts is up to date
            cloudUsages = await getCloudUsages();
            // Merge the local counts with the cloud usage counts
            Object.entries(localUsages).forEach(([url, count]) => {
                if (cloudUsages[url]) {
                    cloudUsages[url] += count;
                } else {
                    cloudUsages[url] = count;
                }
            });
            // Empty the local usage counts
            localUsages = {};
            // Sync the new usage stats to the cloud
            await setCloudUsages(cloudUsages);
            console.log("Synched usage counts", cloudUsages);
        } catch(error) {
            console.log("Failed to sync local and cloud usage counts", error);
            // Reload the local usage counts, since these values were not synced
            localUsages = localUsagesBackup;
        }
    };

    const onTabUpdated = (tabId, {url}) => {
        if (url) {
            debugger;
            const policy = getPolicyMatchingUrl(url);
            if (policy && shouldBlock(policy)) {
                blockTab(tabId, policy.url);
            }
        }
    };
    
    // Updates local policies initially, on interval, and when a change is specifically requested
    updateLocalPolicies();
    setInterval(updateLocalPolicies, UPDATE_POLICIES_INTERVAL);
    chrome.extension.onRequest.addListener(request => 
        (request.action === "reloadPolicies") && updateLocalPolicies()
    );
    // Scan tabs and block urls as needed
    setInterval(scanTabsForLimitedUrls, SCAN_TABS_INTERVAL);
    // Sync local and cloud counts
    setInterval(synchronizeCounts, SYNC_COUNTS_INTERVAL);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

})();
(async function () {
    const MINUTE = 60 * 1000;
    const HOUR = MINUTE * 60;
    const formatDate = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    const getData = () => new Promise(resolve => 
        chrome.storage.sync.get(['daily-usage', 'policies'], response => {
            const usageData = response['daily-usage'];
            const policies = response['policies'];
            const currentDate = formatDate(new Date());

            const usages = usageData.date === currentDate ? usageData.usages : {};
            
            
            return resolve(policies.map(({url, limit}) => {
                const used = usages[url] ? (usages[url] / HOUR) : 0;
                const remaining = limit - used;
                const fractionRemaining = remaining / limit;

                return { url, limit, used, remaining, fractionRemaining };
            }));
        })
    );

    const formatTimeLeft = timeLeft => {
        const hoursRemaining = Math.floor(timeLeft);
        const minutesRemaining = Math.round((timeLeft % 1) * 60);
        if (hoursRemaining > 0 && minutesRemaining > 0) {
            return `${hoursRemaining}h ${minutesRemaining}m`;
        } else if (minutesRemaining > 0) {
            return `${minutesRemaining}m`;
        } else if (hoursRemaining > 0) {
            return `${hoursRemaining}h`;
        } else {
            return "Blocked";
        }
    }
    
    const limitUsageListElem = document.querySelector("#limitProgressList");
    const limitUsageTemplate = document.querySelector("#limitProgressItem");
    const addLimitUsageElem = limit => {
        const clone = document.importNode(limitUsageTemplate.content, true);
        const progressRemainingElem = clone.querySelector(".progress-remaining");

        const progressLabelElem = clone.querySelector(".progress-url");
        progressLabelElem.innerHTML = `${limit.url}`;
        
        const progressTimeLabelElem = clone.querySelector(".progress-time-left");
        progressTimeLabelElem.innerHTML = formatTimeLeft(limit.remaining);
        
        progressRemainingElem.style.setProperty("--percent-remaining",
            `${limit.fractionRemaining * 100}%`);

        
        limitUsageListElem.appendChild(clone);
    }

    // Add click to options page links
    document.querySelectorAll(".options-link")
    .forEach(a => a.addEventListener("click", event => {
        event.preventDefault();
        chrome.runtime.openOptionsPage();
    }));
    
    // Fetch limit usages and add them to the display
// setTimeout(async () => {
    const limits = await getData();
    limits.sort((limitA, limitB) =>
        limitA.fractionRemaining - limitB.fractionRemaining)
    .forEach(addLimitUsageElem);
    
    // Remove the pre-load content
    document.querySelectorAll(".pre-load")
    .forEach(elem => elem.classList.remove("pre-load"));
// }, 2500);
})();
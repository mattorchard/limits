(function(){
    const queryParams = new URLSearchParams(window.location.search);
    const blockedUrl = queryParams.get('url') || "today";

    const urlField = document.querySelector(".url-field");
    urlField.innerHTML = blockedUrl;
    urlField.dataset.triplet = blockedUrl;
})();
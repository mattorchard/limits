(function(){
    const queryParams = new URLSearchParams(window.location.search);
    const blockedUrl = queryParams.get('url');

    const urlField = document.querySelector(".url-field");
    urlField.innerHTML = blockedUrl;
    urlField.dataset.triplet = blockedUrl;
})();
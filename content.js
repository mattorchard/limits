(function content(messageCode) {
	const blockPage = () => {
		window.location = "https://www.example.com";
	}
	
	let blocked = false;
	chrome.runtime.onMessage.addListener(req => {
		if (req.message === messageCode && !blocked) {
			blocked = true;
			blockPage();
		}
	});
})("Matt's secret message code");

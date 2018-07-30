let requiredBuild = document.createElement('script');
requiredBuild.src = chrome.extension.getURL('requiredBuild.js');
requiredBuild.onload = function() {
	console.log("Activated Required Build Script.");
	this.remove();
};
(document.head || document.documentElement).appendChild(requiredBuild);

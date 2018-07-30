// var app = chrome.runtime.getBackgroundPage();
//function bgCall(){
//	chrome.tabs.executeScript({
//		file: 'alert.js'
//	}); 
//}

let requiredBuild = '';

//Get Site info on startup
if (localStorage['site'] === undefined) getLocalIP();

function logTimeForPasswordReset() {
	$('#bCreateTicket').attr('disabled','disabled');
	setTimeout( () => $('#bCreateTicket').removeAttr('disabled'), 5000);
	
	//Make sure there is a value in the text field
	if ($("#agentUsername")[0].value != "") { 
		//Reset user's password in Univention
		if($("#wantsReset").prop("checked")){
			chrome.cookies.getAll({domain: "10.0.35.19", name: "UMCSessionId"}, function(cookie){
				//They don't send cookie info via x-authorization headers anymore
				//They send cookie info via the Cookie header -- need to find a way to set that with a chrome extension!
				var jsonData = {
					"options": [{
						"object": {
							"password": ($("#isTraining").prop("checked")) ? "training" : "cxp2018!",
							"$dn$": `uid=${$("#agentUsername")[0].value},cn=users,dc=connexionpoint,dc=local`, 
							"pwdChangeNextLogin": ($("#isFlagged").prop("checked") && $("#isTraining").prop("checked") === false) ? true : false, 
							"overridePWLength": true, 
							"overridePWHistory": true
						}
					}], 
					"flavor": "users/user"
				};

				//TODO: can I inject this ajax directly into Univention page?
                // chrome.tabs.query({title: 'ucs-master*'}, function(res) {
                 //    console.log(res[0]);
                 //    chrome.tabs.executeScript(res[0].id, {code: ajaxCode}, function(res){
                //
                 //    })
                // });

                $.ajax({
                    url: "https://10.0.35.19/univention/command/udm/put",
                    contentType: "application/json",
                    dataType: "json",
                    headers: { "Content-Type":"application/json","Accept": "application/json","X-Authorization": `OAuth ${cookie[0].value}` },
                    data: JSON.stringify(jsonData),
                    method: "POST",
                    async: false,
                    xhrFields: {withCredentials: true},
                    success: function(data){
                        console.log("Successfully reset password.");
                        if ($("#isFlagged").prop("checked") && $("#isTraining").prop("checked") === false) {
                            let flagData = {
                                "options": [{
                                    "object": {
                                        "$dn$": `uid=${$("#agentUsername")[0].value},cn=users,dc=connexionpoint,dc=local`,
                                        "pwdChangeNextLogin": true
                                    }
                                }],
                                "flavor": "users/user"
                            };

                            $.ajax({
                                url: "https://10.0.35.19/univention/command/udm/put",
                                contentType: "application/json",
                                dataType: "json",
                                headers: { "Content-Type":"application/json","Accept": "application/json","X-Authorization": `OAuth ${cookie[0].value}` },
                                data: JSON.stringify(flagData),
                                method: "POST",
                                success: function(data){
                                    console.log("Successfully flagged password.");
                                },
                                error: function(){
                                    console.log("Failed to flag password.");
                                }
                            });
                        }
                    },
                    error: function(){
                        console.log("Failed to reset password.");
                    }
                });//End of $.ajax

				$.ajax({
					url: "https://10.0.35.19/univention/command/udm/put", 
					contentType: "application/json",
					dataType: "json",
					headers: { "Content-Type":"application/json","Accept": "application/json","X-Authorization": `OAuth ${cookie[0].value}` },
					data: JSON.stringify(jsonData), 
					method: "POST",
					async: false,
                    xhrFields: {withCredentials: true},
					success: function(data){
						console.log("Successfully reset password.");
						if ($("#isFlagged").prop("checked") && $("#isTraining").prop("checked") === false) {
							let flagData = {
								"options": [{
									"object": {
										"$dn$": `uid=${$("#agentUsername")[0].value},cn=users,dc=connexionpoint,dc=local`, 
										"pwdChangeNextLogin": true
									}
								}], 
								"flavor": "users/user"
							};
							
							$.ajax({
								url: "https://10.0.35.19/univention/command/udm/put", 
								contentType: "application/json",
								dataType: "json",
								headers: { "Content-Type":"application/json","Accept": "application/json","X-Authorization": `OAuth ${cookie[0].value}` },
								data: JSON.stringify(flagData), 
								method: "POST",
								success: function(data){
									console.log("Successfully flagged password.");
								},
								error: function(){
									console.log("Failed to flag password.");
								}
							});
						}
					},
					error: function(){
						console.log("Failed to reset password.");
					}
				});//End of $.ajax

			});//End of chrome.cookies
		}//End of resetting UNI password

		//Grab access token from Axosoft cookie to make API call
		chrome.cookies.get({url: "https://connexionpoint.axosoft.com/", name: "client_oauth_token"}, function(cookie){
			//Grab user info to push into ticket

			var token = cookie.value;
			var data = getAxoUserInfo(cookie.value);
			data.token = cookie.value;
			
			//Create ticket
			var ticketNo = createTicket(data); //Returns number without SRX, f.ex. 238596
			if(!ticketNo) return;
			
			//Log time in ticket
			logTimeIntoTicket(data, ticketNo);
			
			//Reset form
			console.log("Successfully created and logged time into ticket");
			$("#agentUsername")[0].value = '';
			$("#wantsReset").prop("checked", true);
			$("#isFlagged").prop("checked", false);
			$("#isTraining").prop("checked", false);
			$("#successMessage").attr("padding: 5px;");
			$("#successMessage").text("Successfully created ticket.");
			setTimeout(function(){
				$("#successMessage").attr("padding: 0px;"); 
				$("#successMessage").text("");
			}, 5000);
		});
	}
}

function getAxoUserInfo(token) {
	var data;
	$.ajax({
		url: `https://connexionpoint.axosoft.com/api/v6/me`,
		contentType: "application/json",
		headers: { "X-Authorization": `OAuth ${token}` },
		async: false,
		success: function(jsonData){
			data = jsonData.data;
			console.log("getAxoUserInfo success!");
		}
	});
	return data;
}

function createTicket(data){
	var agent = $("#agentUsername")[0].value;
	var ticketNo;
	var ticket = {
	"notify_customer": false,
	"item": {
    "name": `Password Reset for ${agent}`,
    "description": "password reset",
    "notes": "",
    "resolution": `${($("#isFlagged").prop("checked") && $("#isTraining").prop("checked") === false) ? "Flagged and " : ""}reset password for ${agent} to ${($("#isTraining").prop("checked")) ? "training" : "cxp2018!"}`,
    "replication_procedures": "",
    "percent_complete": 100,
	"archived": false,
    "publicly_viewable": false,
    "completion_date": getDateTime(false),
    "due_date": null,
    "reported_date": null,
    "start_date": null,
    "assigned_to": {
      "id": data.id//,
      //"type": "user"
    },
    "escalation_level": {
      "id": 0
    },
    "priority": {
      "id": 0
    },
    "project": {
      "id": "744"
    },
    "parent": {
      "id": 0
    },
    "release": {
      "id": 0
    },
    "reported_by": {
      "id": data.id
    },
    "reported_by_customer_contact": {
      "id": 0
    },
    "severity": {
      "id": 0
    },
    "status": {
      "id": 6
    },
    "workflow_step": {
      "id": 49
    },
    "actual_duration": {
      "duration": 0,
      "time_unit": {
        "id": 0
      }
    },
    "estimated_duration": {
      "duration": 0,
      "time_unit": {
        "id": 0
      }
    },
    "remaining_duration": {
      "duration": 0,
      "time_unit": {
        "id": 2
      }
    },
    "custom_fields": {
      "custom_364": false,
      "custom_327": "N/A",
      "custom_187": "",
      "custom_200": 0,
      "custom_205": false,
      "custom_351": "",
      "custom_199": "",
      "custom_356": false,
      "custom_287": 0,
      "custom_179": "",
      "custom_210": 0,
      "custom_389": [
        "Password Reset"
      ],
      "custom_279": null,
      "custom_355": false,
      "custom_224": false,
      "custom_326": [
        "No"
      ],
      "custom_354": false,
      "custom_208": "",
      "custom_363": "",
      "custom_231": false,
      "custom_353": false,
      "custom_203": 0,
      "custom_352": "",
      "custom_204": "",
      "custom_234": [],
      "custom_201": null,
      "custom_329": "",
      "custom_330": "Corp/Support",
      "custom_206": false,
      "custom_225": localStorage['site'],
      "custom_184": "",
      "custom_191": null,
      "custom_377": "",
      "custom_375": false,
      "custom_376": [],
      "custom_195": ""
    }
  }
};

    chrome.cookies.get({url: "https://connexionpoint.axosoft.com/", name: "buildNum"}, function(cookie){
        requiredBuild = cookie.value;
    });

	$.ajax({
		url: `https://connexionpoint.axosoft.com/api/v6/incidents/?require_build=${requiredBuild}`,
		contentType: "application/json",
		dataType: "json",
		headers: { "Content-Type":"application/json","Accept": "application/json","X-Authorization": `OAuth ${data.token}` },
		data: JSON.stringify(ticket), 
		method: "POST",
		async: false,
		success: function(jsonData){
			ticketNo = (jsonData['data']['number']).substr(3);
			console.log("createTicket success!");
		},
		error: function(xhr, status, error){
			ticketNo = null;
			console.log("createTicket failed.");
			console.log(status);
			console.log(error);
		}
	});

	return ticketNo;
}

function logTimeIntoTicket(userData, ticketNo){
	var timeLog = {
		"user": {"id": userData.id}, 
		"work_done": {"duration": "5", "time_unit": {"id": 1}}, 
		"item": {"item_type": "incidents", "id": Number(ticketNo)},
		"work_log_type": {"id": 2},
		"description": "Password reset", 
		"date_time": getDateTime(true),
		"remaining_time": {
			"duration": 0, 
			"time_unit": {"id": 2}
		},
		"update_remaining_time": true
	};
	
	$.ajax({
		url: `https://connexionpoint.axosoft.com/api/v6/work_logs/?require_build=${requiredBuild}`,
		contentType: "application/json",
		headers: { "X-Authorization": `OAuth ${userData.token}` },
		data: JSON.stringify(timeLog), 
		method: "POST",
		success: function(){
			console.log("logTimeIntoTicket success!");
		}
	});
}

function getLocalIP(){
	//compatibility for firefox and chrome
	window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;   
    var site;
	var pc = new RTCPeerConnection({iceServers:[]}), noop = function(){};      
    pc.createDataChannel("");    //create a bogus data channel
    pc.createOffer(pc.setLocalDescription.bind(pc), noop);    // create offer and set local description
    pc.onicecandidate = function(ice){  //listen for candidate events
        if(!ice || !ice.candidate || !ice.candidate.candidate)  return;
		var site = /[0-9]{1,3}\.([0-9]{1,3})/.exec(ice.candidate.candidate)[1];
        pc.onicecandidate = noop;
		if (site == 1) localStorage['site'] = "SLC";
		else if (site == 11) localStorage['site'] = "PRV";
		else if (site == 12) localStorage['site'] = "ROY";
		else if (site == 13) localStorage['site'] = "SAT";
		else if (site == 230) localStorage['site'] = "SAT";
		else if (site == 14) localStorage['site'] = "MEM";
		else if (site == 15) localStorage['site'] = "SUN";
		else if (site == 16) localStorage['site'] = "SAT2";
		else if (site == 18) localStorage['site'] = "SAW";
    };
}

function getDateTime(isTimeLog){
	var d = new Date();
	if (isTimeLog) d.setTime(d.getTime() + 25200000)
	return `${d.getYear()+1900}-${(d.getMonth()+1 < 10) ? "0"+(d.getMonth()+1) : d.getMonth()+1}-${(d.getDate() < 10) ? "0"+d.getDate() : d.getDate() }T${(d.getHours() < 10) ? "0"+d.getHours() : d.getHours()}:${(d.getMinutes() < 10) ? "0"+d.getMinutes() : d.getMinutes()}:${(d.getSeconds() < 10) ? "0"+d.getSeconds() : d.getSeconds()}Z`;
}
	
document.getElementById('bCreateTicket').addEventListener('click', logTimeForPasswordReset);
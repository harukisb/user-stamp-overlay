/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

    This file is what connects to chat and parses messages as they come along. The chat client connects via a
    Web Socket to Twitch chat. The important part events are onopen and onmessage.
*/

var STAMP_SIZE = 50;
var STAMP_PER_USER = 4;

setInterval(function () {
    var lgs = document.getElementsByClassName("lg");
    var now = new Date().getTime();
    for (var i = 0; i < lgs.length; i++) {
        if ((now - lgs[i].getAttribute("data-added-time")) >= 300000) {
            lgs[i].remove();
        }
    }
}, 100);

var chatClient = function chatClient(options) {
    this.username = options.username;
    this.password = options.password;
    this.channel = options.channel;

    this.server = 'irc-ws.chat.twitch.tv';
    this.port = 443;
}

chatClient.prototype.open = function open() {
    this.webSocket = new WebSocket('wss://' + this.server + ':' + this.port + '/', 'irc');

    this.webSocket.onmessage = this.onMessage.bind(this);
    this.webSocket.onerror = this.onError.bind(this);
    this.webSocket.onclose = this.onClose.bind(this);
    this.webSocket.onopen = this.onOpen.bind(this);
};

chatClient.prototype.onError = function onError(message) {
    console.log('Error: ' + message);
};

/* This is an example of a leaderboard scoring system. When someone sends a message to chat, we store
   that value in local storage. It will show up when you click Populate Leaderboard in the UI.
*/
chatClient.prototype.onMessage = function onMessage(message) {
    if (message !== null) {
        var parsed = this.parseMessage(message.data);
        if (parsed !== null) {
            if (parsed.command === "PRIVMSG") {

                if (parsed.message.startsWith("!lovegori") ||
                    parsed.message.startsWith("!lg") ||
                    !isNaN(parsed.message.trim()) ||
                    isCordinateStr(parsed.message.trim())
                ) {
                    x = NaN;
                    y = NaN;
                    if (!isNaN(parsed.message.trim())) {
                        a = areaToCordinate(parsed.message.trim());
                        x = a[0];
                        y = a[1];
                    } else {
                        x = +parsed.message.trim().split(" ")[0];
                        y = +parsed.message.trim().split(" ")[1];
                    }
                    if (isNaN(x) || isNaN(y)) {
                        console.log("failed to pased: " + parsed.message);
                        return;
                    }
                    console.log(x);
                    console.log(y);
                    putStamp(parsed.username,
                        'lovegorilla',
                        x - STAMP_SIZE / 2, y - STAMP_SIZE / 2
                    )
                }
            } else if (parsed.command === "PING") {
                this.webSocket.send("PONG :" + parsed.message);
            }
        }
    }
};

function areaToCordinate(areaNumber) {
    if (areaToCordinate <= 0 || areaToCordinate >= 10) {
        return [NaN, NaN];
    }
    var xAxis = (areaNumber - 1) % 3;
    var yAxis = (areaNumber - 1) / 3;
    return [centerlize(getRandomInt(0, 240) + xAxis * 240, 400),
        centerlize(getRandomInt(0, 160) + yAxis * 180, 250)];
};

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function centerlize(number, center) {
    diff = Math.abs(number - center);
    if (number < center) {
        return number + diff * 0.3;
    } else {
        return number - diff * 0.3;
    }
}

function isCordinateStr(str) {
    str = str.trim();
    splitted = str.split(' ');
    return splitted.length === 2 && !isNaN(splitted[0]) && !isNaN(splitted[1]);
};

function deleteIfExists(username) {
    var lgs = document.getElementsByClassName("lg");
    var cnt = 0;
    for (var i = lgs.length - 1; i >= 0; i--) {
        if (username === lgs[i].getAttribute("data-username")) {
            cnt++;
            if (cnt >= STAMP_PER_USER) {
                lgs[i].remove();
                return true;
            }
        }
    }
    return false;
}

function putStamp(username, stampname, x, y) {
    deleteIfExists(username);
    var stampContainer = document.createElement('span');
    var containerStyle = 'position: absolute; top: ' + y + 'px; left: ' + x + 'px';
    var now = new Date().getTime();
    stampContainer.setAttribute('style', containerStyle);
    stampContainer.setAttribute('class', 'lg');
    stampContainer.setAttribute('data-username', username);
    stampContainer.setAttribute('data-added-time', now);

    var img = document.createElement('img');
    img.setAttribute('style', 'width: ' + STAMP_SIZE + 'px; heigt: ' + STAMP_SIZE + 'px;');
    img.setAttribute('src', './lovegorilla.png');

    var span = document.createElement("span");
    var spanstyle = 'position: absolute; top: 0px; left: 75px;'
        + 'font-size: 12px; font-weight: bold; background: white;';
//  span.innerHTML = username;
    span.setAttribute('style', spanstyle);

    var main = document.getElementById("main");
    stampContainer.appendChild(img);
    stampContainer.appendChild(span);
    main.appendChild(stampContainer);
}

chatClient.prototype.onOpen = function onOpen() {
    var socket = this.webSocket;

    if (socket !== null && socket.readyState === 1) {
        console.log('Connecting and authenticating...');

        socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
        socket.send('PASS ' + this.password);
        socket.send('NICK ' + this.username);
        socket.send('JOIN ' + this.channel);
    }
};

chatClient.prototype.onClose = function onClose() {
    console.log('Disconnected from the chat server.');
};

chatClient.prototype.close = function close() {
    if (this.webSocket) {
        this.webSocket.close();
    }
};

/* This is an example of an IRC message with tags. I split it across
multiple lines for readability. The spaces at the beginning of each line are
intentional to show where each set of information is parsed. */

//@badges=global_mod/1,turbo/1;color=#0D4200;display-name=TWITCH_UserNaME;emotes=25:0-4,12-16/1902:6-10;mod=0;room-id=1337;subscriber=0;turbo=1;user-id=1337;user-type=global_mod
// :twitch_username!twitch_username@twitch_username.tmi.twitch.tv
// PRIVMSG
// #channel
// :Kappa Keepo Kappa

chatClient.prototype.parseMessage = function parseMessage(rawMessage) {
    var parsedMessage = {
        message: null,
        tags: null,
        command: null,
        original: rawMessage,
        channel: null,
        username: null
    };

    if (rawMessage[0] === '@') {
        var tagIndex = rawMessage.indexOf(' '),
            userIndex = rawMessage.indexOf(' ', tagIndex + 1),
            commandIndex = rawMessage.indexOf(' ', userIndex + 1),
            channelIndex = rawMessage.indexOf(' ', commandIndex + 1),
            messageIndex = rawMessage.indexOf(':', channelIndex + 1);

        parsedMessage.tags = rawMessage.slice(0, tagIndex);
        parsedMessage.username = rawMessage.slice(tagIndex + 2, rawMessage.indexOf('!'));
        parsedMessage.command = rawMessage.slice(userIndex + 1, commandIndex);
        parsedMessage.channel = rawMessage.slice(commandIndex + 1, channelIndex);
        parsedMessage.message = rawMessage.slice(messageIndex + 1);
    } else if (rawMessage.startsWith("PING")) {
        console.log("PING!");
        parsedMessage.command = "PING";
        parsedMessage.message = rawMessage.split(":")[1];
    }

    return parsedMessage;
}

/* Builds out the top 10 leaderboard in the UI using a jQuery template. */
function buildLeaderboard() {
    var chatKeys = Object.keys(localStorage),
        outputTemplate = $('#entry-template').html(),
        leaderboard = $('.leaderboard-output'),
        sortedData = chatKeys.sort(function (a, b) {
            return localStorage[b] - localStorage[a]
        });

    leaderboard.empty();

    for (var i = 0; i < 10; i++) {
        var viewerName = sortedData[i],
            template = $(outputTemplate);

        template.find('.rank').text(i + 1);
        template.find('.user-name').text(viewerName);
        template.find('.user-points').text(localStorage[viewerName]);

        leaderboard.append(template);
    }
}

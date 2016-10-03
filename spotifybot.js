"use strict";

let setup = require('./bot_setup.js');

let Botkit = require('botkit');
let Spotify = require('spotify-node-applescript');

let https = require('https');

var os = require('os');
var moment = require('moment');

var lastTrackId;
var channelId;

var stretchSong = "spotify:track:6MeNtkNT4ENE5yohNvGqd4"; // Hey Arnold
var designSong = "spotify:track:3kNCWu425qKEonNX6lQLoi"; // Chicka Chicka
var launchSong = "spotify:track:2xF0GzAiDMEugLYqLZFWLr"; // Push It - Salt N Pepa
var latinDinner = "spotify:user:spotifyenespa%C3%B1ol:playlist:1Cor41e1mw9SppXRBxMg8h"; // Latin Dinner Playlist

var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: setup.token
}).startRTM();

var init = () => {
    bot.api.channels.list({}, function(err, response) {
        if(err) {
            throw new Error(err);
        }

        if (response.hasOwnProperty('channels') && response.ok) {
            var total = response.channels.length;
            for (var i = 0; i < total; i++) {
                var channel = response.channels[i];
                if(verifyChannel(channel)) {
                    return;
                }
            }
        }
    });

    bot.api.groups.list({}, function(err, response) {
        if(err) {
            throw new Error(err);
        }

        if (response.hasOwnProperty('groups') && response.ok) {
            var total = response.groups.length;
            for (var i = 0; i < total; i++) {
                var channel = response.groups[i];
                if(verifyChannel(channel)) {
                    return;
                }
            }
        }
    });
};

controller.hears(['help'],'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message,'You can say these things to me:\n'+
        'hello - I will greet you back\n'+
        'info - I will tell you about this track\n'+
        'detail - I will tell you more about this track\n'+
        'next - Fed up with the track? Skip it.\n'+
        'play / pause - plays or pauses the music\n'+
        'volume up / down - increases / decreases the volume\n'+
        'lunch - plays the latin dinner playlist\n'+
        'launch - plays the launch song\n'+
        'design - plays the design sign-off song');
});

controller.hears(['hello','hi'],'direct_message,direct_mention,mention',function(bot,message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'radio',
    }, function(err,res) {
        if (err) {
            bot.botkit.log("Failed to add emoji reaction :(",err);
        }
    });


    controller.storage.users.get(message.user,function(err,user) {
        if (user && user.name) {
            bot.reply(message,"Hello " + user.name + "!!");
        }
        else {
            bot.reply(message,"Hello.");
        }
    });
});


controller.hears(['what is this','what\'s this','info','playing','what is playing','what\'s playing'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getTrack(function(err, track){
        if(track) {
            lastTrackId = track.id;
            bot.reply(message,'This is ' + trackFormatSimple(track) + '!');
        }
    });
});

controller.hears(['detail'],'direct_message,direct_mention,mention', function(bot, message) {
    Spotify.getTrack(function(err, track){
        if(track) {
            lastTrackId = track.id;
            getArtworkUrlFromTrack(track, function(artworkUrl) {
                bot.reply(message, trackFormatDetail(track)+"\n"+artworkUrl);
            });
        }
    });
});

controller.hears(['next', 'skip', 'BLERG'],'direct_message,direct_mention,mention', function(bot, message) {
    var messager;
    Spotify.next(function(err, track){
        bot.reply(message, 'Skipping to the next track...');

        var messagesentby = message.user;
        bot.api.users.info({user: messagesentby}, function(err, response) {
            if(response && !err) {
                messager = response.user;
                console.log(messager);
                if (messager && messager.name) {
                   bot.say({text: "Skip Triggered by @" + messager.name+" !!", channel: channelId});
                   } else {
                    bot.say({text: "Skip", channel: channelId});
                  }
            }
        });
    });
});

controller.hears(['play','resume','go'],'direct_message,direct_mention,mention', function(bot, message) {
    var messager;
    Spotify.getState(function(err, state){
        if(state.state == 'playing') {
            bot.reply(message, 'Already playing...');
            return;
        }

        Spotify.play(function(){
            bot.reply(message, 'Resuming playback...');
            var messagesentby = message.user;
            bot.api.users.info({user: messagesentby}, function(err, response) {
                if(response && !err) {
                    messager = response.user;
                    console.log(messager);
                    if (messager && messager.name) {
                       bot.say({text: "Play Triggered by @" + messager.name+" !!", channel: channelId});
                       } else {
                        bot.say({text: "Play", channel: channelId});
                      }
                }
            });
        });
    });
});

controller.hears(['stop','pause','shut up'],'direct_message,direct_mention,mention', function(bot, message) {
    var messager;
    Spotify.getState(function(err, state){
        if(state.state != 'playing') {
            bot.reply(message, 'Not currently playing...');
            return;
        }

        Spotify.pause(function(){
            bot.reply(message, 'Pausing playback...');
            var messagesentby = message.user;
            bot.api.users.info({user: messagesentby}, function(err, response) {
                if(response && !err) {
                    messager = response.user;
                    console.log(messager);
                    if (messager && messager.name) {
                       bot.say({text: "Pause Triggered by @" + messager.name+" !!", channel: channelId});
                       } else {
                        bot.say({text: "Pause", channel: channelId});
                      }
                }
            });
        });
    });
});

controller.hears(['louder( \d+)?','volume up( \d+)?','pump it( \d+)?'],'direct_message,direct_mention,mention', function(bot, message) {
    var increase = message.match ? parseInt(message.match[1], 10) : undefined;
    Spotify.getState(function(err, state){
        var volume = state.volume;

        if(volume == 100) {
            bot.reply(message, 'Already playing at maximum volume!');
            return;
        }

        var newVolume = increase ? volume + increase : volume + 10;
        if(!newVolume) {
            return;
        }
        else if(newVolume > 100) {
            newVolume = 100;
        }

        Spotify.setVolume(newVolume, function(){
            bot.reply(message, `Increased volume from ${volume} to ${newVolume}`);
        });
    });
});

controller.hears(['quieter( \d+)?','volume down( \d+)?','shhh( \d+)?'],'direct_message,direct_mention,mention', function(bot, message) {
    var decrease = message.match ? parseInt(message.match[1], 10) : undefined;
    Spotify.getState(function(err, state){
        var volume = state.volume;

        if(volume == 0) {
            bot.reply(message, 'I can\'t go any lower... (my career as a limbo dancer was a short one)');
            return;
        }

        var newVolume = decrease ? volume - decrease : volume - 10;
        if(!newVolume && newVolume !== 0) {
            return;
        }
        else if(newVolume < 0) {
            newVolume = 0;
        }

        Spotify.setVolume(newVolume, function(){
            bot.reply(message, `Decreased volume from ${volume} to ${newVolume}`);
        });
    });
});


controller.on('bot_channel_join', function(bot, message) {
    let inviterId = message.inviter;
    let channelId = message.channel;
    var inviter, channel;

    let done = () => {
        if(inviter && channel) {
            inviteMessage(inviter, channel);
            verifyChannel(channel);
        }
    };

    bot.api.channels.info({channel: channelId}, function(err, response) {
        if(response && !err) {
            channel = response.channel;
            done();
        }
    });

    bot.api.users.info({user: inviterId}, function(err, response) {
        if(response && !err) {
            inviter = response.user;
            done();
        }
    });
});

controller.on('bot_group_join', function(bot, message) {
    let inviterId = message.inviter;
    let channelId = message.channel;
    var inviter, channel;

    let done = () => {
        if(inviter && channel) {
            inviteMessage(inviter, channel);
            verifyChannel(channel);
        }
    };

    bot.api.groups.info({channel: channelId}, function(err, response) {
        if(response && !err) {
            channel = response.group;
            done();
        }
    });

    bot.api.users.info({user:  inviterId}, function(err, response) {
        if(response && !err) {
            inviter = response.user;
            done();
        }
    });
});


function inviteMessage(inviter, channel) {
    Spotify.getTrack(function(err, track){
        var nowPlaying;
        let welcomeText = `Thanks for inviting me, ${inviter.name}! Good to be here :)\n`;

        if(track) {
            lastTrackId = track.id;
            getArtworkUrlFromTrack(track, function(artworkUrl) {
                bot.say({
                    text: welcomeText+'Currently playing: '+trackFormatSimple(track),
                    channel: channel.id
                });
            });
        }
        else {
            bot.say({
                text: welcomeText+'There is nothing currently playing',
                channel: channel.id
            });
        }
    });
}

// Check for Get up and Stretch Time.
setInterval(() => {
  var time = moment().format('h:mm a');

  if(time=='10:30 am'){
    Spotify.getTrack(function(err, track) {
      if(track && (track.id !== stretchSong)) {
        Spotify.playTrack(stretchSong, function(){
          bot.say({
              text: time,
              channel: channelId
          });
        });
      }
    });
  }

  if(time=='3:00 pm'){
    Spotify.getTrack(function(err, track) {
      if(track && (track.id !== stretchSong)) {
        Spotify.playTrack(stretchSong, function(){
          bot.say({
              text: time,
              channel: channelId
          });
        });
      }
    });
  }


}, 3000);


// launch (launchSng) song
controller.hears(['launch'],'direct_message,direct_mention,mention', function(bot, message) {
  var messager;
  Spotify.getTrack(function(err, track) {
    if(track && (track.id !== launchSong)) {
      Spotify.playTrack(launchSong, function(){
        Spotify.jumpTo(0, function() {
        });

        var messagesentby = message.user;
        bot.api.users.info({user: messagesentby}, function(err, response) {
            if(response && !err) {
                messager = response.user;
                console.log(messager);
                if (messager && messager.name) {
                   bot.say({text: ":rocket: Triggered by @" + messager.name+" !!", channel: channelId});
                   } else {
                    bot.say({text: ":rocket:", channel: channelId});
                  }
            }
        });
      });
    }
  });
});

controller.hears(['lunch'],'direct_message,direct_mention,mention', function(bot, message) {
  var messager;
  Spotify.getTrack(function(err, track) {
    if(track && (track.id !== latinDinner)) {
      Spotify.playTrack(latinDinner, function(){
        var messagesentby = message.user;
        bot.api.users.info({user: messagesentby}, function(err, response) {
            if(response && !err) {
                messager = response.user;
                console.log(messager);
                if (messager && messager.name) {
                   bot.say({text: ":fork_and_knife: Triggered by @" + messager.name+" !!", channel: channelId});
                   } else {
                    bot.say({text: ":fork_and_knife:", channel: channelId});
                  }
            }
        });
      });
    }
  });
});

controller.hears(['design'],'direct_message,direct_mention,mention', function(bot, message) {
  var messager;
  Spotify.getTrack(function(err, track) {
    if(track && (track.id !== designSong)) {
      Spotify.playTrack(designSong, function(){
        var messagesentby = message.user;
        bot.api.users.info({user: messagesentby}, function(err, response) {
            if(response && !err) {
                messager = response.user;
                console.log(messager);
                if (messager && messager.name) {
                   bot.say({text: ":pencil2: Triggered by @" + messager.name+" !!", channel: channelId});
                   } else {
                    bot.say({text: ":pencil2:", channel: channelId});
                  }
            }
        });
      });
    }
  });
});

let trackFormatSimple = (track) => `_${track.name}_ by *${track.artist}*`;
let trackFormatDetail = (track) => `_${track.name}_ by _${track.artist}_ is from the album *${track.album}*\nIt has been played ${track['played_count']} time(s).`;
let getArtworkUrlFromTrack = (track, callback) => {
    let trackId = track.id.split(':')[2];
    let reqUrl = 'https://api.spotify.com/v1/tracks/'+trackId;
    var req = https.request(reqUrl, function(response) {
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function() {
            var json = JSON.parse(str);
            if(json && json.album && json.album.images && json.album.images[1]) {
                callback(json.album.images[1].url);
            }
            else {
                callback('');
            }
        });
    });
    req.end();

    req.on('error', function(e) {
      console.error(e);
    });
};

controller.hears(['uptime','identify yourself','who are you','what is your name'],'direct_message,direct_mention,mention',function(bot,message) {
    var hostname = os.hostname();
    var time = moment().format('MMMM Do YYYY, h:mm:ss a');
    var uptime = formatUptime(process.uptime());

    bot.reply(message,':robot_face: I am a bot named <@' + bot.identity.name +'>. I have been running for ' + uptime + ' on ' + hostname + ". the current time is " + time);
});

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit +'s';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}

function verifyChannel(channel) {
    if(channel && channel.name && channel.id && setup.channel && channel.name == setup.channel) {
        channelId = channel.id;
        console.log('** ...chilling out on #' + channel.name);
        return true;
    }

    return false;
}

init();
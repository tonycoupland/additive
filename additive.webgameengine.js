/// <reference path="helpers.js" />
/// <reference path="additive.gameengine.js" />
var Additive = Marjuan.Helpers.namespace('Marjuan.Additive');

// The web game engine is the holder for all web (Uno2) based games
//  Trophies and game state are written via web calls
//  Rendering is expected to be a browser

Additive.WebGameEngine = function (settings) {


    var _self = (this instanceof arguments.callee) ? this : {};
    var _settings = settings || {};
    var _rootURL = settings.hasOwnProperty('rootURL') ? settings.rootURL : 'http://additive.coupland.me';

    // Create user unique gamer ID... or get it from cookie
    var _userUID = $.cookie('userUID');
    var _user = undefined;
    if (_userUID == undefined) {
        _userUID = Marjuan.Helpers.createGUID();
        _user = {};
        $.cookie('userUID', _userUID, { expires: 4000 });

        // Record new user on server!
        postUser(hideSplash);
    }
    else {
        // Get user object from server
        getUser(hideSplash);
    }
    function hideSplash() {
        // Hide splash
        $('#splash').delay(1000).animate({ opacity: 0 }, 400, function () {
            $('#splash').hide();
        });
    }
    var _visitID = undefined;
    var _lastPost = new Date();

    var trophies = $('#trophies');

    var TROPHIES = [
    //        { name: 'gametime', description: 'Total game time', value: '', isTrophy: false },
    //        { name: 'longestgame', description: 'Longest Game', value: '', isTrophy: false },
    //        { name: 'gamesplayed', description: 'Games played', value: '', isTrophy: false },

        {name: 'juniorhighscore', description: 'Junior Highest Score', value: '', isTrophy: false },
        { name: 'freshmanhighscore', description: 'Freshman Highest Score', value: '', isTrophy: false },
        { name: 'difficulthighscore', description: 'Difficult Highest Score', value: '', isTrophy: false },
        { name: 'geniushighscore', description: 'Genius Highest Score', value: '', isTrophy: false },
        { name: 'trophies', description: 'Trophies', value: '', isTrophy: false },

        { name: 'twoinone', description: 'Stu birds with one stone', value: true, isTrophy: true },
        { name: 'onedowntwoup', description: 'Speculate to accumulate', value: true, isTrophy: true },
        { name: 'thousandmoves', description: 'An epic game', value: true, isTrophy: true },
        { name: 'fivetozero', description: 'Five to Zero', value: true, isTrophy: true },
        { name: 'bruteforce', description: 'Janusz\' brute farce', value: true, isTrophy: true },
        { name: 'newgame', description: 'Throwing in the towel', value: true, isTrophy: true },
        { name: 'threelostinonego', description: 'Star massacre', value: true, isTrophy: true },

        { name: 'juniorgamecomplete', description: 'Junior complete!', value: true, isTrophy: true },

        { name: 'freshmangamecomplete', description: 'Freshman complete!', value: true, isTrophy: true },

        { name: 'difficultgamecomplete', description: 'Difficult complete!', value: true, isTrophy: true },

        { name: 'geniusthirty', description: 'The magic number', value: true, isTrophy: true },
        { name: 'geniusforty', description: 'Fore!', value: true, isTrophy: true },
        { name: 'geniusfifty', description: 'High five', value: true, isTrophy: true },
        { name: 'geniussixty', description: 'Six pest', value: true, isTrophy: true },
        { name: 'geniusseventy', description: 'Head in a box', value: true, isTrophy: true },
        { name: 'geniuseighty', description: 'Octo plus', value: true, isTrophy: true },
        { name: 'geniusninety', description: 'Oh nein you didn\'t', value: true, isTrophy: true },
        { name: 'geniusgamecomplete', description: 'Genius complete!', value: true, isTrophy: true }
    ];

    // Create trophies items
    for (var n = 0; n < TROPHIES.length; n++) {
        // Add trophy line to trophy box
        TROPHIES[n].div = $('<div class="trophy" id="trophy_' + TROPHIES[n].name + '"><div class="description">' + TROPHIES[n].description + '</div></div>')
        TROPHIES[n].div.css('background-color', Additive.Game.COLOURS[n % 9]);
        trophies.append(TROPHIES[n].div);

        // Add value box if not a trophy
        if (TROPHIES[n].isTrophy) {
            TROPHIES[n].div.append('<div class="mark" style="background-color:' + Additive.Game.COLOURS[n % 9] + ';"></div>');
        }
        else {
            TROPHIES[n].div.append('<div class="value"></div>');
        }
    }


    // Create GameEngine with hooks to read and write to uno web server
    var _engine = new Additive.GameEngine({

        saveGame: function (game, isNew) {
            // If we havent created this visit for this user yet, or if we've not posted for over an hour,
            // create a new session
            postVisit();

            // Write game to server
            postGame(game, isNew);

            // Is this a new high score for this gametype?
            if (_user) {
                if (!_user.highScores) {
                    _user.highScores = {};
                }
                if (!_user.highScores.hasOwnProperty(game.getLevel()) || (game.getScore() > _user.highScores[game.getLevel()])) {
                    _user.highScores[game.getLevel()] = game.getScore();
                }
            }

        },

        loadGame: function (callback) {
            // If userdata is not yet available... wait just a second
            f();
            function f() {
                if (_user == undefined) {
                    setTimeout(f, 300);
                }
                else {
                    if (_user.lastGame) {
                        callback(_user.lastGame);
                    }
                    else {
                        callback(undefined);
                    }
                }
            }
        },

        trophyAchieved: function (game, trophyName) {
            // If we've not had this trophy yet...
            var bNewAcheivment = true;
            if (_user && _user.trophies) {
                for (var n = 0; n < _user.trophies.length; n++) {
                    if (_user.trophies[n].trophyName == trophyName) {
                        bNewAcheivment = false;
                        break;
                    }
                }
            }

            if (bNewAcheivment) {

                var trophy = {
                    gameid: game.getGameID(),
                    uid: _userUID,
                    sessionid: _visitID,
                    trophyName: trophyName
                };

                // Post to server
                postVisit();
                postTrophy(trophy, function () {
                    // Slide in trophy banner
                    var banner = undefined;
                    for (var n = 0; n < TROPHIES.length; n++) {
                        if (TROPHIES[n].name == trophyName) {
                            TROPHIES[n].div.children('.mark').addClass('marked');
                            banner = TROPHIES[n].div.clone();
                            banner.addClass('notification');
                            break;
                        }
                    }
                    if (banner != undefined) {
                        var hiddenHeight = parseInt(banner.css('height'));
                        banner.css('top', -hiddenHeight + 'px').css('z-index', 20);
                        $('#main').append(banner);
                        banner.animate({ top: 0 }, 600).delay(2000).animate({ top: -hiddenHeight }, 600, function () {
                            banner.remove();
                        });
                    }

                    // Update user object
                    if (_user) {
                        if (!_user.trophies) {
                            _user.trophies = [];
                        }
                        _user.trophies.push(trophy);
                    }
                });
            }
        },

        getHighScore: function (gameType, callback) {
            // If userdata is not yet available... wait just a second
            f();
            function f() {
                if (_user == undefined) {
                    setTimeout(f, 300);
                }
                else {
                    if (_user && _user.highScores && _user.highScores.hasOwnProperty(gameType)) {
                        callback(_user.highScores[gameType]);
                    }
                    else {
                        callback(0);
                    }
                }
            };
        },

        showTrophies: function () {
            // Blur
            $('#main').css('-webkit-filter', 'blur(4px) contrast(0.4) brightness(1.4)').css('-webkit-transform','translate3d(0, 0, 0)');
            // Show background
            $('#trophybackground').show();

            // Update values in trophies UI... highscores, trophy totals, trophies got etc
            $('#trophy_juniorhighscore .value').html((_user.highScores && _user.highScores.hasOwnProperty('Junior')) ? Marjuan.Helpers.formatNumberWithCommas(_user.highScores['Junior']) : '-');
            $('#trophy_freshmanhighscore .value').html((_user.highScores && _user.highScores.hasOwnProperty('Freshman')) ? Marjuan.Helpers.formatNumberWithCommas(_user.highScores['Freshman']) : '-');
            $('#trophy_difficulthighscore .value').html((_user.highScores && _user.highScores.hasOwnProperty('Difficult')) ? Marjuan.Helpers.formatNumberWithCommas(_user.highScores['Difficult']) : '-');
            $('#trophy_geniushighscore .value').html((_user.highScores && _user.highScores.hasOwnProperty('Genius')) ? Marjuan.Helpers.formatNumberWithCommas(_user.highScores['Genius']) : '-');

            // Ensure trophies are ticked if the user has them
            var trophyCount = 0;
            if (_user && _user.trophies) {
                for (var n = 0; n < _user.trophies.length; n++) {
                    var trophyDiv = $('#trophy_' + _user.trophies[n].trophyName + ' .mark');
                    if (trophyDiv && trophyDiv.length > 0) {
                        trophyDiv.addClass('marked');
                        trophyCount++;
                    }
                }
            }
            $('#trophy_trophies .value').html(trophyCount + '/' + (TROPHIES.length - 5));

            // Slide down trophies screen
            var boardBorder = parseInt($('#trophies').css('padding'));
            $('#trophies').css('top', -$('#trophies').height())
                    .show()
                    .animate({ top:
                                (($(window).height() - $('#trophies').height()) / 2) - boardBorder
                    }, 600);
        },

        resizeEvent: function (BOARD_LEFT, BOARD_TOP, BOARD_BORDER, CELL_SIZE, MARKER_SIZE, BUTTON_SIZE) {
            // Resize trophies
            $('#trophies').css('left', Math.floor(($(window).width() - (BUTTON_SIZE * 3)) / 2) + 'px')
                        .css('width', (BUTTON_SIZE * 3) + 'px')
                        .css('height', ($(window).height() - (8 * BOARD_BORDER)) + 'px')
                        .css('font-size', Math.floor(MARKER_SIZE / 4) + 'px')
                        .css('line-height', (MARKER_SIZE - 4) + 'px')
                        .css('padding', BOARD_BORDER + 'px');
            $('.trophy').css('height', ((BUTTON_SIZE / 2) - 4) + 'px')
                        .css('font-size', Math.floor(BUTTON_SIZE / 9) + 'px')
                        .css('line-height', ((BUTTON_SIZE / 2) - 4) + 'px')
                        .css('margin-bottom', Math.floor(BOARD_BORDER) + 'px');
            $('.trophy .mark').css('height', ((BUTTON_SIZE / 2) - 4) + 'px')
                        .css('width', ((BUTTON_SIZE / 2) - 4) + 'px')
                        .css('right', 4 + 'px');
            // Last trophy has no margin-bottom
            $('.trophy:last-child').css('margin-bottom', '0');
            if ($('#trophies').is(":visible")) {
                $('#trophies').css('top', (($(window).height() - $('#trophies').height()) / 2) - BOARD_BORDER);
            }
        }

    });
    _engine.initialise();
    this.getGameEngine = function (){ return _engine;};


    // Handle trophy background click
    $('#trophybackground').on('mouseup', function () {
        $('#trophies').animate({ top: -$('#trophies').height() - 200 }, 400, function () {
            $('#trophybackground').hide();
            $('#trophies').hide();
            $('#main').css('-webkit-filter', '');
        });
    });



    function postUser(callback) {
        var url = _rootURL + '/users/new?id=' + _userUID;
        $.ajax({
            type: "POST",
            url: url,
            complete: function () {
                callback();
            }
        });
    }
    function getUser(callback) {
        var url = _rootURL + '/users/getUserStats?id=' + _userUID;
        $.ajax({
            type: "GET",
            url: url,
            success: function (data) {
                _user = data;
            },
            complete: function () {
                if (_user == undefined) {
                    _user = {};
                }
                callback();
            }
        });
    }
    function postVisit() {
        if (_visitID == undefined || (new Date().getTime() - _lastPost.getTime() > (1000 * 60 * 60))) {
            _visitID = Marjuan.Helpers.createGUID();

            var url = _rootURL + '/visits/new?uid=' + _userUID + '&sessionid=' + _visitID;
            $.ajax({
                type: "POST",
                url: url,
                data: _visitID
            });
        }
    }
    function postGame(game, isNew) {
        // Post game progress
        var game = {
            gameid: game.getGameID(),
            gametype: game.getLevel(),
            uid: _userUID,
            sessionid: _visitID,
            score: game.getScore(),
            moves: game.getMoves(),
            moveHistory: game.getMoveHistory()
        };
        var url = _rootURL + '/games/' + (isNew ? 'new' : 'update') + '/' + game.gameid;
        $.ajax({
            type: "POST",
            url: url,
            data: game
        });
    }
    function postTrophy(trophy, callback) {
        var url = _rootURL + '/users/trophyAcheived/' + _userUID;
        $.ajax({
            type: "POST",
            url: url,
            data: trophy,
            complete: callback
        });
    }
};

/// <reference path="helpers.js" />
/// <reference path="additive.game.js" />
var Additive = Marjuan.Helpers.namespace('Marjuan.Additive');

// GameEngine handles controls such as new game etc
// Methods can be overridden to replace functionality such as where to save game state to
Additive.GameEngine = function (settings) {

    var _self = (this instanceof arguments.callee) ? this : {};
    var _settings = settings || {};

    var _saveGame = (_settings.saveGame instanceof Function ? _settings.saveGame : undefined);
    var _loadGame = (_settings.loadGame instanceof Function ? _settings.loadGame : undefined);

    var _trophyAchieved = (_settings.trophyAchieved instanceof Function ? _settings.trophyAchieved : undefined);
    var _getHighScore = (_settings.getHighScore instanceof Function ? _settings.getHighScore : undefined);
    var _showTrophies = (_settings.showTrophies instanceof Function ? _settings.showTrophies : undefined);

    var _resizeEvent = (_settings.resizeEvent instanceof Function ? _settings.resizeEvent : undefined);

    var _gameEndEvent = (_settings.gameEndEvent instanceof Function ? _settings.gameEndEvent : undefined);

    var _game = undefined;

    // Controls
    var cmdMenu = undefined;
    var cmdTrophies = undefined;
    var scoreBox = undefined;
    var highscoreBox = undefined;

    // Sizing members
    var BOARD_LEFT = 50;
    var BOARD_SIZE = 7;
    var BOARD_TOP = 50;
    var BOARD_BORDER = 10;
    var CELL_SIZE = 100;
    var MARKER_SIZE = 50;
    var BUTTON_SIZE = 100;

    this.getCellSize = function () { return CELL_SIZE; }
    this.getMarkerSize = function () { return MARKER_SIZE; }
    this.getBoardBorder = function () { return BOARD_BORDER; }
    this.getLeftBorder = function () { return BOARD_LEFT; }
    this.getTopBorder = function () { return BOARD_TOP; }
    this.isPortrait = function () { return $(window).width() < $(window).height(); }

    this.getGame = function () { return _game; }
    this.showHighscore = function (hs) {
        highscoreBox.children('.value').html(Marjuan.Helpers.formatNumberWithCommas(hs));
    };

    this.initialise = function () {
        // Convert touches into mouse events
        var gameboard = document.getElementById('body');
        gameboard.addEventListener("touchstart", touchHandler.bind(this), true);
        gameboard.addEventListener("touchmove", touchHandler.bind(this), true);
        gameboard.addEventListener("touchend", touchHandler.bind(this), true);
        gameboard.addEventListener("touchcancel", touchHandler.bind(this), true);
        function touchHandler(event) {
            var touches = event.changedTouches, first = touches[0], type = "";
            switch (event.type) {
                case "touchstart": type = "mousedown"; break;
                case "touchmove": type = "mousemove"; break;
                case "touchend": type = "mouseup"; break;
                default: return;
            }
            var simulatedEvent = document.createEvent("MouseEvent");
            simulatedEvent.initMouseEvent(type, true, true, window, 1,
                              first.screenX, first.screenY,
                              first.clientX, first.clientY, false,
                              false, false, false, 0/*left*/, null);
            first.target.dispatchEvent(simulatedEvent);
            event.preventDefault();
        }

        // Setup screen, add new game, trophies buttons and score/high score fields
        cmdMenu = $('<div class="button">Menu</div>').appendTo('#main');
        cmdMenu.css('background-color', Additive.Game.COLOURS[0]);
        cmdMenu.on('click mouseup', function () {
            // Show new game dialog
            $('#main').css('-webkit-filter', 'blur(4px) contrast(0.4) brightness(1.4)').css('-webkit-transform','translate3d(0, 0, 0)');
            // Show background
            $('#menubackground').show();
            // Ensure main menu is shown
            $('#mainmenu').show().css('left', BOARD_BORDER + 'px');
            // Slide down dialog
            $('#menu').css('top', -$('#menu').height()).show().animate({ top: (($(window).height() - $('#menu').height()) / 2) - BOARD_BORDER }, 600);
        });
        $('#menubackground').on('mouseup', function () {
            $('#menu').animate({ top: -$('#menu').height() - 200 }, 400, function () {
                $('#menubackground').hide();
                $('#main').css('-webkit-filter', '');
                $('.menu').hide();
            });
        });
        cmdTrophies = $('<div class="button trophies">Trophies</div>').appendTo('#main');
        cmdTrophies.css('background-color', Additive.Game.COLOURS[1]);
        cmdTrophies.on('mouseup', function () {
            if (_showTrophies != undefined) {
                _showTrophies();
            }
        });
        scoreBox = $('<div class="textfield"><div class="label">Score</div><div class="value">0</div></div>').appendTo('#main');
        scoreBox.css('background-color', Additive.Game.COLOURS[3]);
        scoreBox.children('.label').css('color', Additive.Game.COLOURS[3]);
        highscoreBox = $('<div class="textfield"><div class="label">High Score</div><div class="value">0</div></div>').appendTo('#main');
        highscoreBox.css('background-color', Additive.Game.COLOURS[4]);
        highscoreBox.children('.label').css('color', Additive.Game.COLOURS[4]);

        // Create top level menu
        $('#menu').append('<div id="mainmenu" class="menu"/>');
        $('#mainmenu').append($('<div class="newgametype button" style="position:relative; background-color:' + Additive.Game.COLOURS[0] + ';">New Game</div>'));
        $('#mainmenu').append($('<div class="instructions button" style="position:relative; background-color:' + Additive.Game.COLOURS[1] + ';">Instructions</div>'));
        $('#mainmenu').append($('<div class="about button" style="position:relative; background-color:' + Additive.Game.COLOURS[3] + ';">About</div>'));

        // Create new game menu
        $('#menu').append('<div id="newgametype" class="menu" style="display:none;"/>');
        for (var n = 0; n < Additive.Game.GAMELEVELS.length; n++) {
            var level = Additive.Game.GAMELEVELS[n];
            var button = $('<div class="newgamelevel button" gametypename="' + level.name + '" style="background-color:' + level.colour + ';">' + level.name + '</div>');
            $('#newgametype').append(button);
        }

        // Prepare instructions div
        $('.menu#instructions p:nth-child(1)').css('color', 'Black');
        $('.menu#instructions p:nth-child(2)').css('color', Additive.Game.COLOURS[0]);
        $('.menu#instructions p:nth-child(3)').css('color', Additive.Game.COLOURS[3]);
        $('.menu#instructions p:nth-child(4)').css('color', Additive.Game.COLOURS[5]);
        $('.menu#instructions p:nth-child(5)').css('color', Additive.Game.COLOURS[7]);

        // Prepare about div
        $('.menu#about p:nth-child(1)').css('color', 'Black');
        $('.menu#about p:nth-child(2)').css('color', Additive.Game.COLOURS[0]);
        $('.menu#about p:nth-child(3)').css('color', Additive.Game.COLOURS[3]);
        $('.menu#about p:nth-child(4)').css('color', Additive.Game.COLOURS[5]);
        $('.menu#about p:nth-child(5)').css('color', Additive.Game.COLOURS[7]);

        // Handle top level click 
        $('#mainmenu').on('mouseup', '.button', function () {
            var button = $(this).attr('class').split(' ')[0];

            // Slide out main menu
            $('#mainmenu').animate({ left: -$('#menu').width() - 200 }, 400, function () {
                $('#mainmenu').hide();
            });
            $('#' + button).css('left', $('#menu').width() + 200 + 'px').show().animate({ left: BOARD_BORDER }, 400, function () {
            });
        });

        // Handle instructions or about click (return to main menu)
        $('.submenu').on('mouseup', 'p', function () {

            // Slide out this menu
            var submenu = $(this).parent();
            submenu.animate({ left: $('#menu').width() }, 400, function () {
                $(this).hide();
            });
            $('#mainmenu').show().animate({ left: BOARD_BORDER }, 400, function () {
            });
        });

        // Handle new game click
        $('#newgametype').on('mouseup', '.button', function () {

            // Fire 'game end' event
            if (_game && _gameEndEvent instanceof Function )
            {
                _game.setGameEnded(Marjuan.Helpers.formatDateTimeHyphenated());
                _gameEndEvent(_game);
            }

            // Remember number of moves in old game
            var oldGameMoves = (_game ? _game.getMoves() : 0);

            $('#menu').animate({ top: -$('#menu').height() - 200 }, 400, function () {
                $('#menubackground').hide();
                $('#main').css('-webkit-filter', '');
                $('.menu').hide();
            });

            var gametype = $(this).attr('gametypename');
            createGame(gametype);
                             
                             
             // Save game to write state
             if (_saveGame != undefined) {
                 _saveGame(_game, true);
             }
            // Throwing in the towel is only valid after 30 moves
            if (oldGameMoves > 30) {
                postTrophy('newgame');
            }
        });

        // Check if we have a game in progress
        if (_loadGame) {
            _loadGame(function (game) {
                if (game != undefined) {
                    // Create game based on this gameID, type, history etc
                    createGame(game.gametype, game.gameid, game.moves, game.gamestart, game.moveHistory, game.trophies);
                }
                else {
                    // Create new game
                    createGame('Freshman');
                }
            });
        }
        else {
            // Create new game
            createGame('Freshman');
        }



        // Hook into resize
        window.onorientationchange = recalculateBoardSize();
        $(window).resize(recalculateBoardSize);
    };


    // Recalculate UI
    function recalculateBoardSize() {
        var isPortrait = $(window).width() < $(window).height();
        var smallestDimention = Math.min($(window).width(), $(window).height());

        BOARD_LEFT = BOARD_TOP = BOARD_BORDER = (smallestDimention / 40);

        if (isPortrait) {
            BUTTON_SIZE = Math.min(
                        Math.floor(($(window).width() - (2 * BOARD_BORDER)) / 4), // Button is always 1/4 of the width of the portrait
                        Math.floor(($(window).height() - (4 * BOARD_BORDER)) / (5.5 + (0.75 * 5 / 4)) * 5 / 4)
                        );
            CELL_SIZE = Math.min(
                        Math.floor(($(window).height() - (4 * BOARD_BORDER) - (0.75 * BUTTON_SIZE)) / (BOARD_SIZE + 0.5)),
                        Math.floor(($(window).width() - (2 * BOARD_BORDER)) / BOARD_SIZE)
                        );
            MARKER_SIZE = CELL_SIZE * BOARD_SIZE / 10;
            BOARD_LEFT = ($(window).width() - (CELL_SIZE * BOARD_SIZE)) / 2;
            BOARD_TOP = ($(window).height() - (CELL_SIZE * BOARD_SIZE) - (BUTTON_SIZE * 0.75) - (2 * BOARD_BORDER) - MARKER_SIZE) / 2;
        }
        else {
            BUTTON_SIZE = Math.min(
                        Math.floor(($(window).width() - (4 * BOARD_BORDER)) / 6.75 * 5 / 4),
                        Math.floor(($(window).height() - (2 * BOARD_BORDER)) / 4)
                        );
            CELL_SIZE = Math.min(
                        Math.floor(($(window).width() - (4 * BOARD_BORDER) - BUTTON_SIZE) / (BOARD_SIZE + 0.5)),
                        Math.floor(($(window).height() - (2 * BOARD_BORDER)) / BOARD_SIZE)
                        );
            MARKER_SIZE = CELL_SIZE * BOARD_SIZE / 10;
            BOARD_LEFT = ($(window).width() - (CELL_SIZE * BOARD_SIZE) - BUTTON_SIZE - (2 * BOARD_BORDER) - MARKER_SIZE) / 2;
            BOARD_TOP = ($(window).height() - (CELL_SIZE * BOARD_SIZE)) / 2;
            // Ensure there is room for the clock etc
            if (BOARD_TOP < 16) {
                BOARD_TOP = 16;
            }
        }


        // Position game board
        $('#gameboard').css('left', BOARD_LEFT)
                .css('top', BOARD_TOP)
                .css('width', (CELL_SIZE * BOARD_SIZE) + 'px')
                .css('height', (CELL_SIZE * BOARD_SIZE) + 'px');

        // Resize game controls
        if (_game != undefined) {
            _game.resize();
        }

        // Position text fields and trophies popup
        $('#main .button').css('width', (BUTTON_SIZE - 4) + 'px')
            .css('height', ((BUTTON_SIZE / 2) - 4) + 'px')
            .css('font-size', Math.floor(BUTTON_SIZE / 9) + 'px')
            .css('line-height', ((BUTTON_SIZE / 2) - 4) + 'px');
        $('#main .textfield .label, #newgametype .button .label, .submenu .button .label').css('width', (BUTTON_SIZE - 4) + 'px')
            .css('font-size', Math.floor(BUTTON_SIZE / 8) + 'px')
            .css('line-height', (BUTTON_SIZE / 4) + 'px')
            .css('top', -(BUTTON_SIZE / 4) + 'px');
        $('#main .textfield').css('width', (BUTTON_SIZE - 4) + 'px')
            .css('height', ((BUTTON_SIZE / 2) - 4) + 'px')
            .css('font-size', Math.floor(BUTTON_SIZE / 4) + 'px')
            .css('line-height', ((BUTTON_SIZE / 2) - 4) + 'px');

        if (isPortrait) {
            cmdMenu.css('left', BOARD_LEFT)
                .css('top', BOARD_TOP + (BOARD_SIZE * CELL_SIZE) + (2 * BOARD_BORDER) + MARKER_SIZE + (BUTTON_SIZE / 4));
            cmdTrophies.css('left', BOARD_LEFT + BUTTON_SIZE)
                .css('top', BOARD_TOP + (BOARD_SIZE * CELL_SIZE) + (2 * BOARD_BORDER) + MARKER_SIZE + (BUTTON_SIZE / 4));
            scoreBox.css('left', BOARD_LEFT + 2 * BUTTON_SIZE)
                .css('top', BOARD_TOP + (BOARD_SIZE * CELL_SIZE) + (2 * BOARD_BORDER) + MARKER_SIZE + (BUTTON_SIZE / 4));
            highscoreBox.css('left', BOARD_LEFT + 3 * BUTTON_SIZE)
                .css('top', BOARD_TOP + (BOARD_SIZE * CELL_SIZE) + (2 * BOARD_BORDER) + MARKER_SIZE + (BUTTON_SIZE / 4));
        }
        else {
            cmdMenu.css('left', BOARD_LEFT + (2 * BOARD_BORDER) + MARKER_SIZE + (BOARD_SIZE * CELL_SIZE))
                .css('top', BOARD_TOP);
            cmdTrophies.css('left', BOARD_LEFT + (2 * BOARD_BORDER) + MARKER_SIZE + (BOARD_SIZE * CELL_SIZE))
                .css('top', BOARD_TOP + ((BUTTON_SIZE / 2)));
            scoreBox.css('left', BOARD_LEFT + (2 * BOARD_BORDER) + MARKER_SIZE + (BOARD_SIZE * CELL_SIZE))
                .css('top', BOARD_TOP + (2.5 * (BUTTON_SIZE / 2)));
            highscoreBox.css('left', BOARD_LEFT + (2 * BOARD_BORDER) + MARKER_SIZE + (BOARD_SIZE * CELL_SIZE))
                .css('top', BOARD_TOP + (4 * (BUTTON_SIZE / 2)));
        }

        // Resize new game dialog
        $('.menu#mainmenu,.menu#newgametype').css('left', BOARD_BORDER + 'px');
        $('.submenu').css('left', BOARD_BORDER + 'px')
            .css('width', Math.floor(BUTTON_SIZE * 1.5) - 2 * BOARD_BORDER + 'px')
            .css('font-size', Math.floor(BUTTON_SIZE / 6.5) + 'px')
            .css('line-height', Math.floor(BUTTON_SIZE / 6.5) + 'px')
            .css('padding', BOARD_BORDER + 'px');
        $('#menu .button').css('width', Math.floor(BUTTON_SIZE * 1.5) + 'px')
            .css('height', Math.floor(BUTTON_SIZE * 0.75) + 'px')
            .css('font-size', Math.floor(BUTTON_SIZE / 5) + 'px')
            .css('line-height', Math.floor(BUTTON_SIZE * 0.75) + 'px')
            .css('margin-bottom', Math.floor(BOARD_BORDER) + 'px');
        $('.menu#removeads .button').css('width', 'auto');
        $('#menu').css('height', Additive.Game.GAMELEVELS.length * (BUTTON_SIZE * 0.75) + ((Additive.Game.GAMELEVELS.length - 1) * BOARD_BORDER))
            .css('width', Math.floor(BUTTON_SIZE * 1.5) + 'px')
            .css('left', Math.floor(($(window).width() - 1.5 * BUTTON_SIZE - 2 * BOARD_BORDER) / 2) + 'px')
            .css('padding', BOARD_BORDER + 'px');
        if ($('#menu').is(":visible")) {
            $('#menu').css('top', (($(window).height() - $('#menu').height()) / 2));
        }

        // Has anyone subscribed to our resize event?
        if (_resizeEvent != undefined) {
            _resizeEvent(BOARD_LEFT, BOARD_TOP, BOARD_BORDER, CELL_SIZE, MARKER_SIZE, BUTTON_SIZE);
        }
    }
    function postTrophy(trophy) {
        if (_trophyAchieved != undefined) {
            _trophyAchieved(_game, trophy);
        }
    }
    function createGame(gametype, gameID, moves, gamestart, history, trophies) {

        // Create new game
        for (var n = 0; n < Additive.Game.GAMELEVELS.length; n++) {
            var level = Additive.Game.GAMELEVELS[n];
            if (level.name == gametype) {
                BOARD_SIZE = level.size;
                _game = new Additive.Game({ gameEngine: _self,
                    gameID: gameID,
                    level: level,
                    moves: moves,
                    gameStarted: gamestart,
                    history: history,
                    trophiesAchieved: trophies,
                    postGame: function (game, isNew) {
                        // Update score in UI
                        scoreBox.children('.value').html(Marjuan.Helpers.formatNumberWithCommas(game.getScore()));

                        // Save game
                        if (_saveGame != undefined) {
                            _saveGame(game, isNew);

                            // Get the high score
                            if (_getHighScore) {
                                var hs = _getHighScore(gametype, function (highScore) {
                                    highscoreBox.children('.value').html(Marjuan.Helpers.formatNumberWithCommas(highScore));
                                });
                            }
                        }
                    },
                    trophyAchieved: function (trophy) {
                        postTrophy(trophy);
                    }
                });
                _game.setGameStarted(Marjuan.Helpers.formatDateTimeHyphenated());
                _game.initialise();
                recalculateBoardSize();

                // Set the score
                scoreBox.children('.value').html(Marjuan.Helpers.formatNumberWithCommas(_game.getScore()));

                // Get the high score
                if (_getHighScore) {
                    var hs = _getHighScore(gametype, function (highScore) {
                        highscoreBox.children('.value').html(Marjuan.Helpers.formatNumberWithCommas(highScore));
                    });
                }
                break;
            }
        }
    }
};

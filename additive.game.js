/// <reference path="helpers.js" />
var Additive = Marjuan.Helpers.namespace('Marjuan.Additive');

// Game contains all the tiles for the game and all the logic for handling the play
// and calls back to various events for 'save' etc
Additive.Game = function (settings) {


    var _self = (this instanceof arguments.callee) ? this : {};
    var _settings = settings || {};
    var _gameEngine = settings.gameEngine;

    // Get the level from the settings
    var _level = settings.level;
    var _boardSize = _level.size;
    var _maxNewCell = _level.maxNewCell;
    var _markerIncrement = _level.markerIncrement;

    var _postGame = (_settings.postGame instanceof Function ? _settings.postGame : undefined);
    var _trophyAchieved = (_settings.trophyAchieved instanceof Function ? _settings.trophyAchieved : undefined);

    var _moves = (_settings.moves ? _settings.moves : 0);
    var _moveHistory = (_settings.history instanceof Array ? _settings.history : []);
    var _gameID = (_settings.gameID ? _settings.gameID : ''); ;
    var _trophiesAchieved = (_settings.trophiesAchieved instanceof Array ? _settings.trophiesAchieved : []);

    var _cellArray = [];
    var _cellArrayStyles = [];
    var _markerArray = [];

    var _score = 0;
    var _lastMoveDirection = undefined;
    var _lastMoveSameDirectionCount = 0;

    var _gameStarted = (_settings.gameStarted ? _settings.gameStarted : '');
    var _gameEnded = '';

    // Members to store where drag started
    var dragStartedX = undefined;
    var dragStartedY = undefined;

    // Properties
    this.getGameID = function () { return _gameID; };
    this.getLevel = function () { return _level.name; };
    this.getScore = function () { return Math.max(0, (_score * 1000) - _moves); };
    this.getMoves = function () { return _moves; };
    this.getMoveHistory = function () { return _moveHistory; };
    this.getTrophiesAchieved = function() { return _trophiesAchieved; };

    this.getGameStarted = function () { return _gameStarted; };
    this.setGameStarted = function (value) { _gameStarted = value; };
    this.getGameEnded = function () { return _gameEnded; };
    this.setGameEnded = function (value) { _gameEnded = value; };

    this.initialise = function () {

        // Clear out any cells or markers on the game board
        $('#gameboard .cell').remove();
        $('#main .marker').remove();
        _cellArray = [];
        _cellArrayStyles = [];
        _markerArray = [];

        // Create new cells
        for (var n = 0; n < (_boardSize * _boardSize); n++) {
            var cell = createCell();
            _cellArray.push(cell);
            _cellArrayStyles.push(cell[0].style);
        }

        // Create markers
        for (var n = 0; n < 10; n++) {
            var marker = $('<div class="marker">' + ((n + 1) * _markerIncrement) + '</div>');
            $('#main').append(marker);
            _markerArray.push(marker);
        }

        // If we have history... replace values of board with those of the last game
        if (_moveHistory && _moveHistory.length > 0) {
            var board = _moveHistory[_moveHistory.length - 1];
            if (board.length == (_boardSize * _boardSize * 2)) {
                for (var n = 0; n < (_boardSize * _boardSize); n++) {
                    var cellValue = parseInt(board.substr(n * 2, 2), 16);
                    if (cellValue > 100) {
                        cellValue -= 100;
                        _cellArray[n].addClass('marked');
                    }
                    _cellArray[n].html(cellValue);
                }
            }
            // Refresh UI and calculate score etc
            refreshUI();
        }

        // Add mouse down handlers to cells
        $('#gameboard').bind('mousedown', function () {

            dragStartedX = event.clientX;
            dragStartedY = event.clientY;

            $('#gameboard').bind('mousemove', function () {

                // Are we moving horizontally or vertically?
                var delta = getSlideDelta(event.clientX, event.clientY);
                var startTile = getStartTile();


                if ((startTile.y == 0 && delta.y < 0) ||
                (startTile.x == 0 && delta.x < 0) ||
                (startTile.y == (_boardSize - 1) && delta.y > 0) ||
                (startTile.x == (_boardSize - 1) && delta.x > 0)) {
                    delta.x = delta.y = 0;
                }

                moveTiles(delta, startTile, false);
            });

        });

        $('#gameboard').bind('mouseleave', function () {
            $('#gameboard').unbind('mousemove');
            refreshUI()
        });

        $('#gameboard').bind('mouseup', function () {
            $('#gameboard').unbind('mousemove');

            var delta = getSlideDelta(event.clientX, event.clientY);
            var startTile = getStartTile();
            var cellSize = _gameEngine.getCellSize();

            // Have we moved > 0.5 cells?  If so, commit the move
            if ((Math.abs(delta.x) + Math.abs(delta.y)) > (0.5 * cellSize)) {

                // Do we have some adding to do? - i.e. is this a dragging off the board move or not
                if ((startTile.y == 0 && delta.y < 0) ||
                (startTile.x == 0 && delta.x < 0) ||
                (startTile.y == (_boardSize - 1) && delta.y > 0) ||
                (startTile.x == (_boardSize - 1) && delta.x > 0)) {
                    refreshUI();
                    return;
                }

                // Walk cells and increment content of cell with offset cell
                // Direction of move determines offset
                var offset = 0;
                if (delta.x < 0) { offset = -_boardSize; }
                if (delta.x > 0) { offset = _boardSize; }
                if (delta.y < 0) { offset = -1; }
                if (delta.y > 0) { offset = 1; }

                if (_lastMoveDirection == offset) {
                    _lastMoveSameDirectionCount++;
                    if (_lastMoveSameDirectionCount >= 100) {
                        postTrophy('bruteforce');
                    }
                }
                else {
                    _lastMoveDirection = offset;
                    _lastMoveSameDirectionCount = 0;
                }

                var arrayOfTensMadeInThisMove = [];
                var starsBinned = 0;
                for (var n = 0; n < (_boardSize * _boardSize); n++) {
                    var col = Math.floor(n / _boardSize);
                    var row = n % _boardSize;

                    // Is this the moving block (about to be removed?)
                    if (((delta.y != 0) && (startTile.y == row)) || ((delta.x != 0) && (startTile.x == col))) {
                        // Add this tile to the one above/below etc
                        var dest = _cellArray[n + offset];
                        var newValue = parseInt(dest.html()) + parseInt(_cellArray[n].html());
                        if (newValue > 100) newValue -= 100;

                        // Has this new value made this a marked cell?
                        if (newValue % _markerIncrement == 0) {
                            arrayOfTensMadeInThisMove.push(dest);
                        }
                        else {
                            // In case this used to be a marked item... its not now
                            dest.removeClass('marked')
                        }
                        dest.html(newValue);

                        // Clear the moved cells from the board
                        if (_cellArray[n].hasClass('marked')) {
                            starsBinned++;
                        }
                        _cellArray[n].remove();
                    }
                }

                if (starsBinned >= 3) {
                    postTrophy('threelostinonego');
                }


                // Walk all new 10x cells and mark them if now contribute to score
                var scoreDelta = 0;
                for (var n = 0; n < arrayOfTensMadeInThisMove.length; n++) {
                    var dest = arrayOfTensMadeInThisMove[n];

                    // Cell becomes marked if its <= the score+1, or if there exist in this set
                    // all the cells that are between this and the score+1*10
                    var newValue = parseInt(dest.html());
                    var bMarked = true;
                    var neededValue = newValue - _markerIncrement;
                    if (neededValue > 0) {
                        while (neededValue > (_score * _markerIncrement)) {
                            // Find this value
                            var bFound = false;
                            for (var m = 0; m < arrayOfTensMadeInThisMove.length; m++) {
                                if (parseInt(arrayOfTensMadeInThisMove[m].html()) == neededValue) {
                                    bFound = true;
                                }
                            }
                            if (!bFound) {
                                bMarked = false;
                                break;
                            }
                            neededValue -= _markerIncrement;
                        }
                    }
                    if (bMarked) {
                        // This is a scoring cell... how much does it vary from the score
                        scoreDelta = Math.max(scoreDelta, (newValue / _markerIncrement) - _score);
                        dest.addClass('marked')
                    }
                    else {
                        dest.removeClass('marked')
                    }
                }
                // Increased score by 2 or more in this go?
                if (scoreDelta >= 2) {
                    postTrophy('twoinone');

                    if (starsBinned > 0) {
                        postTrophy('onedowntwoup');
                    }
                }

                // Adjust array pointers - looping forwards or backwards depending on delta
                if (offset < 0) {
                    for (var n = 0; n < (_boardSize * _boardSize); n++) {
                        var col = Math.floor(n / _boardSize);
                        var row = n % _boardSize;
                        if (shouldTileMove(delta, startTile, col, row)) {
                            _cellArray[n] = _cellArray[n - offset];
                            _cellArrayStyles[n] = _cellArrayStyles[n - offset];
                        }
                    }
                } else {
                    for (var n = (_boardSize * _boardSize) - 1; n > -1; n--) {
                        var col = Math.floor(n / _boardSize);
                        var row = n % _boardSize;
                        if (shouldTileMove(delta, startTile, col, row)) {
                            _cellArray[n] = _cellArray[n - offset];
                            _cellArrayStyles[n] = _cellArrayStyles[n - offset];
                        }
                    }
                }

                // Add new cells
                if (Math.abs(delta.x) != 0) {
                    var newCol = (delta.x > 0 ? 0 : (_boardSize - 1));
                    for (var n = 0; n < _boardSize; n++) {
                        var cell = createCell(n, newCol);
                        _cellArray[newCol * _boardSize + n] = cell;
                        _cellArrayStyles[newCol * _boardSize + n] = cell[0].style;
                    }
                }
                if (Math.abs(delta.y) != 0) {
                    var newRow = (delta.y > 0 ? 0 : (_boardSize - 1));
                    for (var n = 0; n < _boardSize; n++) {
                        var cell = createCell(newRow, n);
                        _cellArray[n * _boardSize + newRow] = cell;
                        _cellArrayStyles[n * _boardSize + newRow] = cell[0].style;
                    }
                }

                // Refresh UI - and recalculate score
                refreshUI();

                // Increment moves
                _moves++;
                pushBoardToHistory();
                postGame();

                // 1000 moves?
                if (_moves > 1000) {
                    postTrophy('thousandmoves');
                }
            }
            else {
                // Rollback the shift or refresh UI
                refreshUI();
            }
        });


    }

    this.resize = function () {

        // Resize and position cells
        refreshUI();

        // Reposition markers
        var cellSize = _gameEngine.getCellSize();
        var markerSize = _gameEngine.getMarkerSize();
        var boardBorder = _gameEngine.getBoardBorder();
        var leftBorder = _gameEngine.getLeftBorder();
        var topBorder = _gameEngine.getTopBorder();
        var isPortrait = _gameEngine.isPortrait();

        var left, top;
        for (var n = 0; n < 10; n++) {
            if (isPortrait) {
                left = leftBorder + (n * markerSize);
                top = topBorder + boardBorder + (_boardSize * cellSize);
            }
            else {
                left = leftBorder + boardBorder + (_boardSize * cellSize);
                top = topBorder + (n * markerSize);
            }
            _markerArray[n].html((n + 1) * _markerIncrement);
            _markerArray[n].css('left', left)
                .css('top', top)
                .css('background-color', Additive.Game.COLOURS[n])
                .css('width', (markerSize - 4) + 'px')
                .css('height', (markerSize - 4) + 'px')
                .css('font-size', Math.floor(markerSize / 2) + 'px')
                .css('line-height', (markerSize - 4) + 'px');
        }
    }



    // Private methods
    postTrophy = function (trophy) {
        if (_trophyAchieved != undefined) {
            _trophyAchieved(trophy);
        }
        // Add this trophy to our list earned in this game
        var found = false;
        for ( var i=0; i<_trophiesAchieved.length; i++){
            if ( _trophiesAchieved[i] == trophy ){
                found = true;
                break;
            }
        }
        if (!found) {
            _trophiesAchieved.push(trophy);
        }
    }

    postGame = function () {
        if (_postGame != undefined) {
            if (_gameID == '') {
                _gameID = Marjuan.Helpers.createGUID();
                _postGame(_self, true);
            }
            else {
                _postGame(_self, false);
            }
        }
    }

    createCell = function () {
        var cell = $('<div class="cell">' + Math.ceil(Math.random() * _maxNewCell) + '</div>');
        $('#gameboard').append(cell);
        return cell;
    }
    shouldTileMove = function (delta, startTile, col, row) {
        if (delta.x > 0 && col <= startTile.x) return true;
        if (delta.x < 0 && col >= startTile.x) return true;
        if (delta.y > 0 && row <= startTile.y) return true;
        if (delta.y < 0 && row >= startTile.y) return true;
        return false;
    }
    refreshUI = function () {
        moveTiles({ x: 0, y: 0 }, { x: 0, y: 0 }, true);
    }
    function getStartTile() {
        var cellSize = _gameEngine.getCellSize();
        var leftBorder = _gameEngine.getLeftBorder();
        var topBorder = _gameEngine.getTopBorder();

        return { x: Math.floor((dragStartedX - leftBorder) / cellSize),
            y: Math.floor((dragStartedY - topBorder) / cellSize)
        };
    }
    function getSlideDelta(clientX, clientY) {
        var cellSize = _gameEngine.getCellSize();
        var deltaX = clientX - dragStartedX;
        var deltaY = clientY - dragStartedY;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            deltaY = 0;
            if (deltaX < 0) {
                deltaX = Math.max(deltaX, -cellSize);
            } else {
                deltaX = Math.min(deltaX, cellSize);
            }
        }
        else {
            deltaX = 0;
            if (deltaY < 0) {
                deltaY = Math.max(deltaY, -cellSize);
            } else {
                deltaY = Math.min(deltaY, cellSize);
            }
        }
        return { x: deltaX, y: deltaY };
    }
    function pushBoardToHistory() {
        // Build up string to represent board
        var board = '';
        for (var n = 0; n < (_boardSize * _boardSize); n++) {
            var cellValue = parseInt(_cellArray[n].html());
            if (_cellArray[n].hasClass('marked')) {
                cellValue += 100;
            }
            var cell = cellValue.toString(16);
            if (cell.length == 1) cell = '0' + cell;
            board += cell;
        }
        _moveHistory.push(board);
    }
    moveTiles = function (delta, startTile, moveComplete) {
        // Loop through all tiles and move
        var cellSize = _gameEngine.getCellSize();
        var arrayMarkersFound = [false, false, false, false, false, false, false, false, false, false];
        for (var n = 0; n < (_boardSize * _boardSize); n++) {
            var col = Math.floor(n / _boardSize);
            var row = n % _boardSize;

            var bMoveThisTile = shouldTileMove(delta, startTile, col, row);
            var left = col * cellSize + (bMoveThisTile ? delta.x : 0);
            var top = row * cellSize + (bMoveThisTile ? delta.y : 0);
            // If this tile has moved, or we're doing a full refresh... change the css
            if (moveComplete) {
                var value = parseInt(_cellArray[n].html());
                if (value % _markerIncrement == 0 && _cellArray[n].hasClass('marked')) {
                    arrayMarkersFound[(value / _markerIncrement) - 1] = true;
                }
                var colour = Additive.Game.COLOURS[Math.floor((value - 1) / 10)];
                // v1
                //                _cellArray[n].css('left', left)
                //                .css('top', top)

                // v2
                //_cellArray[n].offset({ 'left': left, 'top': top })
                //.css('background-color', colour)
                //.css('width', (cellSize - 4) + 'px')
                //.css('height', (cellSize - 4) + 'px')
                //.css('font-size', Math.floor(cellSize / 2) + 'px')
                //.css('line-height', (cellSize - 4) + 'px')
                //.css('z-index', (bMoveThisTile ? 10 : 9));

                // v3
                _cellArrayStyles[n].left = left + 'px';
                _cellArrayStyles[n].top = top + 'px';
                _cellArrayStyles[n].backgroundColor = colour;
                _cellArrayStyles[n].width = (cellSize - 4) + 'px';
                _cellArrayStyles[n].height = (cellSize - 4) + 'px';
                _cellArrayStyles[n].fontSize = Math.floor(cellSize / 2) + 'px';
                _cellArrayStyles[n].lineHeight = (cellSize - 4) + 'px';
                _cellArrayStyles[n].zIndex = (bMoveThisTile ? 10 : 9);
            }
            else {
                // Just reposition
                //_cellArray[n].offset({ 'left': left, 'top': top }).css('z-index', (bMoveThisTile ? 10 : 9));
                _cellArrayStyles[n].left = left + 'px';
                _cellArrayStyles[n].top = top + 'px';
                _cellArrayStyles[n].zIndex = (bMoveThisTile ? 10 : 9);
            }
        }

        if (moveComplete) {
            // Score is the number of concecutive markers
            var oldScore = _score;
            _score = 0;
            var missedOne = false;
            for (var n = 0; n < 10; n++) {
                if (arrayMarkersFound[n] && !missedOne) {
                    _score++;
                }
                if (!arrayMarkersFound[n]) missedOne = true;
                _markerArray[n].css('opacity', arrayMarkersFound[n] ? 1 : 0.2);
            }

            // Is this score less than it was before?
            if (_score < oldScore) {
                var removedSomeMarkedTiles = false;
                // We may need to remove some stars :(
                for (var n = 0; n < (_boardSize * _boardSize); n++) {
                    var cell = _cellArray[n];
                    var value = parseInt(cell.html());
                    if (value % _markerIncrement == 0 && cell.hasClass('marked')) {
                        if (value > ((_score + 1) * _markerIncrement)) {
                            cell.removeClass('marked')
                            removedSomeMarkedTiles = true;
                        }
                    }
                }
                if (removedSomeMarkedTiles) {
                    // We should check the score again!
                    refreshUI();
                }
            }

            if (oldScore >= 5 && _score == 0) {
                postTrophy('fivetozero');
            }

            // Could this be new trophy teritory
            if (_level.name == 'Genius') {
                if (_score >= 2) postTrophy('geniustwenty');
                if (_score >= 3) postTrophy('geniusthirty');
                if (_score >= 4) postTrophy('geniusforty');
                if (_score >= 5) postTrophy('geniusfifty');
                if (_score >= 6) postTrophy('geniussixty');
                if (_score >= 7) postTrophy('geniusseventy');
                if (_score >= 8) postTrophy('geniuseighty');
                if (_score >= 9) postTrophy('geniusninety');
            }
            if (_score >= 10) {
                postTrophy(_level.name.toLowerCase() + 'gamecomplete');
            }
        }
    }
};


Additive.Game.COLOURS = ['#BF3030', '#BF7130', '#BFA730', '#86B32D', '#269926', '#1D7373', '#992667', '#5F2580', '#3C13AF', '#000000'];
Additive.Game.GAMELEVELS = [
    { name: "Junior", size: 8, maxNewCell: 9, markerIncrement: 10, colour: Additive.Game.COLOURS[0] },
    { name: "Freshman", size: 7, maxNewCell: 9, markerIncrement: 10, colour: Additive.Game.COLOURS[1] },
    { name: "Difficult", size: 6, maxNewCell: 9, markerIncrement: 10, colour: Additive.Game.COLOURS[4] },
    { name: "Genius", size: 5, maxNewCell: 9, markerIncrement: 10, colour: Additive.Game.COLOURS[7] }
    ];

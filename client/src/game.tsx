import * as React from 'react';
import * as ReactDOM from 'react-dom';

import './css/index.css';
import { GameApp } from './components/game/GameApp';

const main = document.getElementById('main');
const gameToken = main.dataset.gametoken;

ReactDOM.render(
    <GameApp gameToken={gameToken} />,
    main
);

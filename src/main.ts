import '@awesome.me/webawesome/dist/styles/webawesome.css';
import './styles/tokens.css';
import './styles/app.css';
import './app/components';
import { startApp } from './app/shell';

startApp(document.getElementById('app')!);

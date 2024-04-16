const feedElement = document.getElementById('feed');
const timeRangeSelect = document.getElementById('timeRange');
const postCountSelect = document.getElementById('postCount');
const feedTypeSelect = document.getElementById('feedType');

let trades = [];
let solPrice = 0; // Placeholder for Solana price
let mintTimers = {}; // Object to hold timers for each mint

timeRangeSelect.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 30, 60].map(min => `<option value="${min}">${min} min</option>`).join('');
postCountSelect.innerHTML = Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}" ${i + 1 === 12 ? 'selected' : ''}>${i + 1}</option>`).join('');

feedTypeSelect.innerHTML = `
    <option value="marketCap">Market Cap</option>
    <option value="totalVolume">Total Volume</option>
    <option value="buyVolume">Buy Volume</option>
    <option value="sellVolume">Sell Volume</option>
    <option value="uniqueTraders">Unique Traders</option>
`;

const socket = io('wss://client-api-2-74b1891ee9f9.herokuapp.com', {
    transports: ['websocket'],
    upgrade: false
});

socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    fetchSolPrice();
});

socket.on('tradeCreated', (newTrade) => {
    const currentTime = Date.now();
    newTrade.receivedTime = currentTime;
    mintTimers[newTrade.mint] = currentTime;

    const existingIndex = trades.findIndex(trade => trade.mint === newTrade.mint && trade.timestamp === newTrade.timestamp && trade.sol_amount === newTrade.sol_amount);
    if (existingIndex === -1) {
        trades.push(newTrade);
        console.log(`Added new trade: ${newTrade.mint}`);
    } else {
        console.log(`Duplicate trade found, not adding: ${newTrade.mint}`);
    }

    trades = trades.filter(trade => currentTime - trade.receivedTime <= 60 * 60 * 1000);
    updateFeed();
});

function flashMarketCap(mint, color) {
    const postElement = document.querySelector(`#${mint} .market-cap`);
    if (postElement) {
        postElement.style.color = color;
        setTimeout(() => postElement.style.color = '', 1000);
    }
}

function fetchSolPrice() {
    solPrice = 172.01;
    updateFeed();
}

function calculateVolumesForDisplay() {
    const currentTime = Date.now();
    const timeLimit = parseInt(timeRangeSelect.value) * 60 * 1000;
    const aggregatedTrades = trades.reduce((acc, trade) => {
        if (currentTime - trade.receivedTime <= timeLimit) {
            if (!acc[trade.mint]) {
                acc[trade.mint] = { ...trade, buyVolume: 0, sellVolume: 0, totalVolume: 0, uniqueTraders: new Set(), lastTradeTime: currentTime };
            }
            const volume = (trade.sol_amount / 1000000000) * solPrice;
            if (trade.is_buy) {
                acc[trade.mint].buyVolume += volume;
            } else {
                acc[trade.mint].sellVolume += volume;
            }
            acc[trade.mint].totalVolume += volume;
            acc[trade.mint].uniqueTraders.add(trade.user);
            acc[trade.mint].lastTradeTime = mintTimers[trade.mint];
            acc[trade.mint].usd_market_cap = trade.usd_market_cap; // Update market cap
        }
        return acc;
    }, {});

    return Object.values(aggregatedTrades).map(trade => {
        trade.uniqueTraders = trade.uniqueTraders.size;
        return trade;
    });
}

function updateFeed() {
    const selectedFeedType = feedTypeSelect.value;
    const numberOfPosts = parseInt(postCountSelect.value);

    let displayTrades = calculateVolumesForDisplay();
    if (selectedFeedType === 'marketCap') {
        displayTrades.sort((a, b) => b.usd_market_cap - a.usd_market_cap);
    } else if (selectedFeedType === 'buyVolume') {
        displayTrades.sort((a, b) => b.buyVolume - a.buyVolume);
    } else if (selectedFeedType === 'sellVolume') {
        displayTrades.sort((a, b) => b.sellVolume - a.sellVolume);
    } else if (selectedFeedType === 'totalVolume') {
        displayTrades.sort((a, b) => b.totalVolume - a.totalVolume);
    } else if (selectedFeedType === 'uniqueTraders') {
        displayTrades.sort((a, b) => b.uniqueTraders - a.uniqueTraders);
    }

    displayTrades = displayTrades.slice(0, numberOfPosts);
    renderTrades(displayTrades);
}

function renderTrades(trades) {
    feedElement.innerHTML = '';
    trades.forEach(trade => {
        const timeSinceLastTrade = Math.floor((Date.now() - trade.lastTradeTime) / 1000);
        const row = document.createElement('tr');

        // Create td elements with appropriate classes
        const cells = [
            createTableCellWithImage(trade.image_uri || 'path/to/default/image.jpg', trade.name, 'table-cell-name'),
            createTableCell(trade.symbol, 'table-cell-symbol'),
            createTableCell(`$${parseFloat(trade.usd_market_cap).toFixed(2)}`, 'table-cell-market-cap'),
            createTableCell(`$${trade.totalVolume.toFixed(2)}`, 'table-cell-total-volume'),
            createTableCell(`$${trade.buyVolume.toFixed(2)}`, 'table-cell-buy-volume'),
            createTableCell(`$${trade.sellVolume.toFixed(2)}`, 'table-cell-sell-volume'),
            createTableCell(trade.uniqueTraders, 'table-cell-unique-traders'),
            createTableCell(timeSinceLastTrade, 'table-cell-time-since-last-trade')
        ];

        // Append td elements to the row
        cells.forEach(cell => row.appendChild(cell));

        // Append row to the table body
        feedElement.appendChild(row);
    });
}
function renderTrades(trades) {
    feedElement.innerHTML = '';
    trades.forEach(trade => {
        const timeSinceLastTrade = Math.floor((Date.now() - trade.lastTradeTime) / 1000);
        const row = document.createElement('tr');

        // Calculate buy and sell ratios
        const buyRatio = trade.buyVolume / (trade.buyVolume + trade.sellVolume);
        const sellRatio = trade.sellVolume / (trade.buyVolume + trade.sellVolume);

        // Determine background color based on ratios
        let backgroundColor;
        if (buyRatio > sellRatio) {
            const greenIntensity = Math.floor(255 * buyRatio);
            backgroundColor = `rgb(${255 - greenIntensity}, ${greenIntensity}, ${255 - greenIntensity})`;
        } else {
            const redIntensity = Math.floor(255 * sellRatio);
            backgroundColor = `rgb(${redIntensity}, ${255 - redIntensity}, ${255 - redIntensity})`;
        }

        // Set background color for the row
        row.style.backgroundColor = backgroundColor;

        // Create td elements with appropriate classes
        const cells = [
            createTableCellWithImage(trade.image_uri || 'path/to/default/image.jpg', trade.name, 'table-cell-name'),
            createTableCell(trade.symbol, 'table-cell-symbol'),
            createTableCell(`$${parseFloat(trade.usd_market_cap).toFixed(2)}`, 'table-cell-market-cap'),
            createTableCell(`$${trade.totalVolume.toFixed(2)}`, 'table-cell-total-volume'),
            createTableCell(`$${trade.buyVolume.toFixed(2)}`, 'table-cell-buy-volume'),
            createTableCell(`$${trade.sellVolume.toFixed(2)}`, 'table-cell-sell-volume'),
            createTableCell(trade.uniqueTraders, 'table-cell-unique-traders'),
            createTableCell(timeSinceLastTrade, 'table-cell-time-since-last-trade')
        ];

        // Append td elements to the row
        cells.forEach(cell => row.appendChild(cell));

        // Append row to the table body
        feedElement.appendChild(row);
    });
}

function createTableCellWithImage(imageUrl, name, className) {
    const cell = document.createElement('td');
    cell.classList.add(className); // Add class to the td element

    // Create an img element
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = name; // Set alt text for accessibility
    img.style.maxWidth = '50px'; // Set max width to 50 pixels
    img.style.maxHeight = '50px'; // Set max height to 50 pixels~
    img.style.paddingRight = '5px'; 

    // Create a span element for the name
    const span = document.createElement('span');
    span.textContent = name;

    // Append both img and span elements to the cell
    cell.appendChild(img);
    cell.appendChild(span);

    return cell;
}

function createTableCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    cell.classList.add(className); // Add class to the td element
    return cell;
}

timeRangeSelect.addEventListener('change', updateFeed);
postCountSelect.addEventListener('change', updateFeed);
feedTypeSelect.addEventListener('change', updateFeed);

updateFeed();

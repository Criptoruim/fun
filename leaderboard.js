const leaderboardElement = document.getElementById('leaderboard');
let traders = {};

// Placeholder for Solana price
let solToUSD = 0;

const socket = io('wss://client-api-2-74b1891ee9f9.herokuapp.com', {
    transports: ['websocket'],
    upgrade: false
});

socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    fetchSolPrice();
});

socket.on('tradeCreated', (newTrade) => {
    if (!traders[newTrade.user]) {
        traders[newTrade.user] = { totalTrades: 0, buyVolumeUSD: 0, sellVolumeUSD: 0 };
    }
    const userTrades = traders[newTrade.user];
    userTrades.totalTrades += 1;

    // Assuming newTrade.sol_amount is in the smallest unit of SOL (lamports) and needs to be converted to SOL
    const solAmount = newTrade.sol_amount / 1000000000; // Conversion from lamports to SOL
    const tradeValueUSD = solAmount * solToUSD; // Convert SOL amount to USD

    if (newTrade.is_buy) {
        userTrades.buyVolumeUSD += tradeValueUSD;
    } else {
        userTrades.sellVolumeUSD += tradeValueUSD;
    }

    updateLeaderboard();
});

function updateLeaderboard() {
    // Sort traders by total trades
    const sortedTraders = Object.entries(traders).sort((a, b) => b[1].totalTrades - a[1].totalTrades);

    leaderboardElement.innerHTML = '';
    sortedTraders.forEach(trader => {
        const row = document.createElement('tr');

        // Create a link element for the trader's name
        const traderLink = document.createElement('a');
        traderLink.href = `https://solscan.io/account/${trader[0]}`;
        traderLink.textContent = trader[0];
        traderLink.target = "_blank"; // Open link in a new tab

        // Create a new <td> element for the trader's name with the link
        const nameCell = document.createElement('td');
        nameCell.appendChild(traderLink);

        // Calculate profit and loss
        const pnl = trader[1].buyVolumeUSD - trader[1].sellVolumeUSD;

        // Create a new <td> element for the profit and loss
        const pnlCell = document.createElement('td');
        pnlCell.textContent = `$${pnl.toFixed(2)}`;

        // Append all <td> elements to the row
        row.appendChild(nameCell); // Append the name cell with the link
        row.innerHTML += `<td>${trader[1].totalTrades}</td>
                          <td>$${trader[1].buyVolumeUSD.toFixed(2)}</td>
                          <td>$${trader[1].sellVolumeUSD.toFixed(2)}</td>`;
        row.appendChild(pnlCell); // Append the P&L cell to the row

        // Append the row to the leaderboard
        leaderboardElement.appendChild(row);
    });
}


function fetchSolPrice() {
    fetch('https://price.jup.ag/v4/price?ids=SOL')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch Solana price');
            }
            return response.json();
        })
        .then(data => {
            solToUSD = data.data.SOL.price;
            console.log('Fetched Solana price:', solToUSD);
            updateLeaderboard(); // Update leaderboard with fetched Solana price
        })
        .catch(error => {
            console.error('Error fetching Solana price:', error.message);
            // You may handle errors here, such as displaying an error message to the user
        });
}

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
    try {
        console.log('New trade received:', newTrade); // Log the entire newTrade object
        const solAmount = newTrade.sol_amount / 1000000000; // Conversion from lamports to SOL
        const priceUSD = solAmount * solToUSD; // Convert SOL amount to USD
        const user = newTrade.user;
        const name = newTrade.name; // Assuming name information is available
        console.log('Name:', name); // Log the name property
        if (!user || !name) {
            throw new Error('User or Name is undefined');
        }
        processTrade(user, name, newTrade.is_buy, solAmount, priceUSD);
        updateLeaderboard(); // Update leaderboard after processing the trade
    } catch (error) {
        console.error('Error processing trade:', error);
    }
});

function processTrade(user, name, isBuy, solAmount, priceUSD) {
    if (!traders[user]) {
        traders[user] = {};
    }
    
    // Check if the trader with the same name already exists for the user
    if (traders[user][name]) {
        const trader = traders[user][name];
        if (isBuy) {
            trader.buys.push({ amount: solAmount, priceUSD: priceUSD });
            trader.buyVolumeUSD += priceUSD;
        } else {
            trader.sells.push({ amount: solAmount, priceUSD: priceUSD });
            trader.sellVolumeUSD += priceUSD;
            calculateProfit(user, name, solAmount, priceUSD);
        }
        trader.totalTrades++;
    } else {
        // Create a new trader entry
        traders[user][name] = {
            buys: isBuy ? [{ amount: solAmount, priceUSD: priceUSD }] : [],
            sells: isBuy ? [] : [{ amount: solAmount, priceUSD: priceUSD }],
            totalTrades: 1,
            buyVolumeUSD: isBuy ? priceUSD : 0,
            sellVolumeUSD: isBuy ? 0 : priceUSD,
            realizedProfit: 0
        };
    }
}

function calculateProfit(user, name, soldAmount, sellPriceUSD) {
    let remainingAmount = soldAmount;
    const trader = traders[user][name];

    while (remainingAmount > 0 && trader.buys.length > 0) {
        let buy = trader.buys[0];

        if (remainingAmount <= buy.amount) {
            trader.realizedProfit += remainingAmount * (sellPriceUSD - buy.priceUSD);
            buy.amount -= remainingAmount;
            if (buy.amount === 0) {
                trader.buys.shift();
            }
            remainingAmount = 0;
        } else {
            trader.realizedProfit += buy.amount * (sellPriceUSD - buy.priceUSD);
            remainingAmount -= buy.amount;
            trader.buys.shift();
        }
    }
}

function updateLeaderboard() {
    const sortedTraders = Object.entries(traders).sort((a, b) => {
        const totalProfitA = Object.values(a[1]).reduce((acc, curr) => acc + curr.realizedProfit, 0);
        const totalProfitB = Object.values(b[1]).reduce((acc, curr) => acc + curr.realizedProfit, 0);
        return totalProfitB - totalProfitA;
    });

    leaderboardElement.innerHTML = sortedTraders.map(([user, names]) => {
        let userHTML = '';
        Object.entries(names).forEach(([name, data]) => {
            let tradesHTML = '';

            if (data.buys.length > 0 || data.sells.length > 0) {
                tradesHTML += '<table>';
                data.buys.forEach(buy => {
                    tradesHTML += `
                        <tr>
                            <td>${name}</td>
                            <td>Buy</td>
                            <td>${buy.priceUSD.toFixed(2)}</td>
                        </tr>
                    `;
                });

                data.sells.forEach(sell => {
                    tradesHTML += `
                        <tr>
                            <td>${name}</td>
                            <td>Sell</td>
                            <td>${sell.priceUSD.toFixed(2)}</td>
                        </tr>
                    `;
                });

                tradesHTML += '</table>';
            }

            userHTML += `
                <tr class="collapsible">
                    <td>${user}</td>
                    <td>${name}</td>
                    <td>${data.totalTrades}</td>
                    <td>${data.buyVolumeUSD.toFixed(2)}</td>
                    <td>${data.sellVolumeUSD.toFixed(2)}</td>
                    <td>${data.realizedProfit.toFixed(2)}</td>
                </tr>
                <tr class="trade-details">
                    <td colspan="6">${tradesHTML}</td>
                </tr>
            `;
        });

        return userHTML;
    }).join('');

    // Add event listeners to collapsible buttons
    const coll = document.getElementsByClassName("collapsible");
    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function () {
            this.classList.toggle("active");
            const tradeDetails = this.nextElementSibling;
            if (tradeDetails.style.maxHeight) {
                tradeDetails.style.maxHeight = null;
            } else {
                tradeDetails.style.maxHeight = tradeDetails.scrollHeight + "px";
            }
        });
    }
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

// Ensure initial leaderboard update on load or when the Sol price is fetched
updateLeaderboard();

// get number value from any given element
function getNumberContent(el) {
  const contentArr = el.innerHTML.split("");
  const num = Number(contentArr.filter(c => c.trim() && !isNaN(c)).join(""));
  return num || 0;
}

// get total from pot
function getPot() {
  return Array.from(document.getElementsByClassName("pot")).reduce(
    (total, e) => {
      const el = Array.from(e.getElementsByClassName("ng-binding ng-scope"));
      const s = el.reduce((a, el) => a + getNumberContent(el), 0);
      return total + s;
    },
    0
  );
}

// get total from each person's bet
function getActiveBets() {
  return Array.from(document.getElementsByClassName("bet")).reduce(
    (total, e) => {
      const el = Array.from(e.getElementsByClassName("ng-binding ng-scope"));
      const s = el.reduce((a, el) => a + getNumberContent(el), 0);
      return total + s;
    },
    0
  );
}

// get total from each person's stack
function getActiveStacks() {
  return Array.from(document.getElementsByClassName("stack")).reduce(
    (total, el) => total + getNumberContent(el),
    0
  );
}

function getGrandTotalChipsInPlay() {
  const funcs = [getActiveBets, getActiveStacks, getPot];
  return funcs.reduce((s, f) => s + f(), 0);
}

function timestamp() {
  const date = new Date();
  const raw = [date.getHours(), date.getMinutes(), date.getSeconds()];
  const processed = raw.map(d => (d < 10 ? `0${d}` : d)).join(":");
  return processed;
}

function logTableStatus() {
  const { lostChips, buyins } = game__getGameState();

  // chips that everyone has contributed
  const rawPool = Object.values(buyins).reduce((t, n) => t + n, 0);

  // chips that are live + chips that have been cashed out
  const grandTotalRealChips = getGrandTotalChipsInPlay() + lostChips;

  const rake = rawPool - grandTotalRealChips;

  game__getGameState().rake = rake;

  console.log(
    `[${timestamp()}] Chips In Play: ${grandTotalRealChips} | Total Rake: ${rake}`
  );
}

// get value of all players and their respective balances
function getPlayerNamesAndBalances() {
  const { buyins } = game__getGameState();

  return Array.from(document.getElementsByClassName("player")).map(el => {
    const name = el.getElementsByClassName("name")[0].innerHTML;
    const stack = el.getElementsByClassName("stack")[0];
    const value = getNumberContent(stack);
    return { name, buyin: buyins[name], value };
  });
}

function formatDollars(value) {
  const result = (value / 100).toFixed(2);
  if (result < 0) return `-$${Math.abs(result).toFixed(2)}`;
  return `$${result}`;
}

function getPlayerStatus() {
  const playersAndBalances = getPlayerNamesAndBalances();
  const totalBalances = playersAndBalances.reduce((t, p) => t + p.value, 0);
  const totalBuyins = playersAndBalances.reduce((t, p) => t + p.buyin, 0);
  // generates a multiplier to account for amount lost to rake
  const adjustment = totalBuyins / getGrandTotalChipsInPlay();
  // fills in more fields in the player object to represent columns
  const withCalc = playersAndBalances.map(p => {
    const adjusted = p.value * adjustment;
    return {
      ...p,
      // adjusted player stack accounting for rake
      adjusted,
      // USD value of stack
      USD: formatDollars(adjusted),
      // net performance of player
      net: formatDollars(adjusted - p.buyin)
    };
  });

  return withCalc;
}

// displays a table of user stats
function logPlayerStatus() {
  console.table(getPlayerStatus());
}

function game__logStatus() {
  logTableStatus();
  logPlayerStatus();
}

let game__CONFIG = {
  defaultBuyinSize: 100,
  logIntervalSeconds: 6
};

function game__getGameConfig() {
  return game__CONFIG;
}

let game__STATE = {
  // player-to-buyin mapping (e.g. { 'player ace': 1500 })
  buyins: {},
  // chips lost to players departing early (e.g. someone stands up and leaves with 517).
  // this should NOT be adjusted if someone simply busts out.
  lostChips: 0,
  rake: 0
};

function game__getGameState() {
  return game__STATE;
}

let game__intervalId;

function game__getIntervalId() {
  return game__intervalId;
}

function game__ABORT() {
  const id = game__getIntervalId();
  console.log(`! aborting interval ${id}`);
  clearInterval(id);
}

function game__RESET() {
  console.log("------------------- resetting game -------------------");
  game__ABORT();
  game__START();
}

function initializePlayerBuyinOverrides() {
  const { defaultBuyinSize } = game__getGameConfig();
  document.getElementsByClassName("player").forEach(el => {
    const name = el.getElementsByClassName("name")[0].innerHTML;
    game__getGameState().buyins = {
      ...game__getGameState().buyins,
      [name]: defaultBuyinSize
    };
  });
}

// main runner
function game__START() {
  const { logIntervalSeconds } = game__getGameConfig();

  initializePlayerBuyinOverrides();

  console.log("------------------- initializing game -------------------");
  game__intervalId = setInterval(() => {
    game__logStatus();
  }, logIntervalSeconds * 1000);
  console.log({ intervalId: game__intervalId });
}

socket.on("chat", body => {
  socket__handleRake(body);
  socket__handleSummary(body);
});

function socket__handleRake({ table, message, player }) {
  if (message.toLowerCase().includes("rake")) {
    console.log(`~ received rake request from ${player}`);
    socket.emit("sendChat", {
      table,
      message: `dealer has taken ${game__STATE.rake}`
    });
  }
}

function socket__handleSummary({ table, message, player }) {
  if (message.toLowerCase().includes("summary")) {
    console.log(`~ received summary request from ${player}`);
    const rows = getPlayerStatus().map(
      row =>
        `${row.name.toUpperCase()} - adj: ${row.adjusted.toFixed(2)} - usd: ${
          row.USD
        } - net: ${row.net}`
    );

    socket.emit("sendChat", {
      table,
      message: rows.join(" ||| ")
    });
  }
}

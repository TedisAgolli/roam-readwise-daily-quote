const HIGHLIGHTS_ROUTE = "https://readwise.io/api/v2/highlights/random";
const NUM_QUOTES = 10;

async function populateCache(token, extensionAPI, fallbackIfError) {
  return fetch(`${HIGHLIGHTS_ROUTE}?numHighlights=${NUM_QUOTES}`, {
    headers: { Authorization: "Token " + token },
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
    })
    .then(({ results }) => extensionAPI.settings.set("quotes", results))
    .catch((err) => {
      console.error(err);
      fallbackIfError();
    });
}

function getTodayPageName() {
  return window.roamAlphaAPI.util.dateToPageTitle(new Date());
}

function getTodayPageUid() {
  return window.roamAlphaAPI.util.dateToPageUid(new Date());
}

function getAllBlocksInPage(pageUid) {
  const ancestorrule = `[ 
            [ (ancestor ?b ?a) 
                [?a :block/children ?b] ] 
            [ (ancestor ?b ?a) 
                [?parent :block/children ?b ] 
                (ancestor ?parent ?a) ] ] ]`;
  const blocks = window.roamAlphaAPI.q(
    `[ 
        :find 
            ?uid, ?string
        :in $ ?pagetitle % 
        :where 
            [?block :block/uid ?uid] 
            [?block :block/string ?string] 
            [?page :node/title ?pagetitle] 
            (ancestor ?block ?page)
        ]`,
    pageUid,
    ancestorrule
  );
  return blocks;
}

function createSettings(extensionAPI) {
  extensionAPI.settings.panel.create({
    tabTitle: "Readwise Daily Quote",
    settings: [
      {
        id: "authorization-token",
        name: "Token",
        action: {
          type: "input",
          placeholder: "Enter your token here",
          onChange: (evt) =>
            debounce(() => {
              const token = evt.target.value;
              insertQuoteOrError(token, extensionAPI);
            }, 300),
        },
      },
    ],
  });
}

function createErrorBlock() {
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": getTodayPageUid(), order: 0 },
    block: {
      string:
        "__Go to Settings -> Readwise Random Quote and enter your token. Get your token [here](https://readwise.io/access_token).__",
      uid: window.roamAlphaAPI.util.generateUID().slice(0, 3) + "-error",
    },
  });
}

function containsBlockWithExtension(extension) {
  const blocks = getAllBlocksInPage(getTodayPageName());
  return blocks.filter((block) => block[0].endsWith(extension)).length > 0;
}

function insertQuoteOrError(token, extensionAPI) {
  const hasQuote = containsBlockWithExtension("-quote");
  const hasError = containsBlockWithExtension("-error");

  if (!token && !hasError) {
    createErrorBlock();
    return;
  }

  if (!hasQuote) {
    getFromCacheOrAPI(token, extensionAPI, hasError);
  }
}

let timer;
function debounce(fn, d) {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(fn, d);
}
async function getFromCacheOrAPI(token, extensionAPI, hasError) {
  let quotes = extensionAPI.settings.get("quotes");
  if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
    await populateCache(token, extensionAPI, () => {
      if (!hasError) {
        createErrorBlock();
      }
    });
    // get fresh data
    quotes = extensionAPI.settings.get("quotes");
  }

  if (quotes && quotes.length > 0) {
    const quote = quotes.pop();
    insertQuote(quote);
    await extensionAPI.settings.set("quotes", quotes);
  }
}

function insertQuote(quote) {
  const { text, title, author, id } = quote;
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": getTodayPageUid(), order: 0 },
    block: {
      string: `**${text}** - __${title}__, ${author} [View in Readwise](https://readwise.io/open/${id})`,
      uid: window.roamAlphaAPI.util.generateUID().slice(0, 3) + "-" + "quote",
    },
  });
}

export default {
  onload: ({ extensionAPI }) => {
    createSettings(extensionAPI);
    const token = extensionAPI.settings.get("authorization-token");
    insertQuoteOrError(token, extensionAPI);

    const id = setInterval(() => {
      const token = extensionAPI.settings.get("authorization-token");
      insertQuoteOrError(token, extensionAPI);
    }, 60 * 60 * 1000);
    localStorage.setItem("readwise-interval-id", id);
  },
  onunload: () => {
    const id = localStorage.getItem("readwise-interval-id");
    localStorage.removeItem("readwise-interval-id");
    clearTimeout(id);
  },
};

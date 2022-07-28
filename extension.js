function insertQuote(token, fallbackIfError) {
  fetch("https://readwise.io/api/v2/highlights/random?numHighlights=1", {
    headers: { Authorization: "Token " + token },
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
    })
    .then(({ results }) => {
      const quote = results[0];
      const { text, title, author, id } = quote;
      console.log(results);
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": getTodayPageUid(), order: 0 },
        block: {
          string: `**${text}** - __${title}__, ${author} [View in Readwise](https://readwise.io/open/${id})`,
          uid:
            window.roamAlphaAPI.util.generateUID().slice(0, 3) + "-" + "quote",
        },
      });
    })
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
              console.log("Input Changed!", token);
              insertQuoteOrError(token);
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

function insertQuoteOrError(token) {
  const hasQuote = containsBlockWithExtension("-quote");
  const hasError = containsBlockWithExtension("-error");

  if (!token && !hasError) {
    createErrorBlock();
    return;
  }

  if (!hasQuote) {
    insertQuote(token, () => {
      if (hasError) return;
      createErrorBlock(hasError);
    });
  }
}

let timer;
function debounce(fn, d) {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(fn, d);
}

export default {
  onload: ({ extensionAPI }) => {
    console.log("onload");
    createSettings(extensionAPI);
    const token = extensionAPI.settings.get("authorization-token");
    insertQuoteOrError(token);
  },
  onunload: () => {},
};

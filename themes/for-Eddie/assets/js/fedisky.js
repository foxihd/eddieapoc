let replies = 0;
let reblogs = 0;
let favourites = 0;

const date = new Date();
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        formatMatcher: 'basic'
    }).replace(',', '').replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')
}
const toISOString = (dateString) => {
    return new Date(dateString).toISOString()
}

const respondToVisibility = (element, callback) => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                callback();
            }
        });
    });
    observer.observe(element);
}
const addToCounter = (reply, reblog, favorite) => {
    replies = replies + reply;
    reblogs = reblogs + reblog;
    favourites = favourites + favorite;
}
const renderStat = (count, url, label, interaction) => `<a class='${interaction} ${count > 0 ? 'active' : ''}' href='${url}' rel='external noreferrer nofollow' aria-label='${label}'><span>${count > 0 ? count : ''}</span></a>`;
const getURI = (url, format) => {
    const splitUrl = url.split('/');
    const isUrl = splitUrl[0] === 'https:' || splitUrl[0] === 'http:';
    return isUrl ? format(splitUrl) : url;
}
const checkResponseStatus = (response) => {
    if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
    }
}
const bskyRoot = getElement('bsky-comments');
const cmt = getElement('comments');
const {
    i18nReplies,
    i18nReblogs,
    i18nFavourites,
    i18nLoading,
    i18nErr,
    i18nNocomment
} = cmt.dataset;

const cmtSty = document.createElement('style');
cmtSty.textContent = `#stats{display:flex;justify-content:center;margin:0 0 1rem;gap:2ex;}.stat>a{color:var(--mid);}.stat a.active{color:#006aff;}.stat .favourites.active{color:red;}.fed-comments{position:relative;margin:3rem 0 4rem;border-radius:2rem;background-color:#805b5b33;padding:2rem 2rem 3rem;}.fed-comments>span>a{color:var(--mid);}.fed-comments>span{position:absolute;top:-2rem;right:2rem;transition:.2s;border:none;border-radius:1px;font-size:1rem;}.fed-comments .stat{position:relative;top:-1.5rem;right:1rem;font-size:1rem;}.fed-comments p{margin:0;line-height:1.618;}.attachments{margin-top:1pc;}.contentinfo{display:flex;position:absolute;bottom:-1.5rem;left:-1.5rem;align-items:center;justify-content:space-between;width:100%;}.author{display:flex;align-items:center;color:var(--fg);gap:1ex;}.author img{border-radius:50%;width:3rem;height:3rem;object-fit:cover;}.alternate>li>article .contentinfo,.alternate>li>article .author{flex-direction:row-reverse;}`;
document.head.appendChild(cmtSty);

if (bskyRoot) {
    var bskyCommentsLoaded = false;
    const skeetURL = bskyRoot.dataset.url;
    const toBskyURL = (uri) => {
        const splitUri = uri.split('/');
        return splitUri[0] === 'at:'
            ? 'https://bsky.app/profile/' + splitUri[2] + '/post/' + splitUri[4]
            : uri;
    }
    const toAtProtoURI = (splitUrl) => `at://${splitUrl[4]}/app.bsky.feed.post/${splitUrl[6]}`;
    const ToBskyImgURL = (did, blobLink, thumb) => `https://cdn.bsky.app/img/${thumb ? 'feed_thumbnail' : 'feed_fullsize'}/plain/${did}/${blobLink}`;
    const bskyAPI = getURI(skeetURL, toAtProtoURI);
    if (bskyAPI !== skeetURL) {
        const loadbskyAPI = async () => {
            if (bskyCommentsLoaded) return;
            try {
                const skeetResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${bskyAPI}`);
                console.log(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${bskyAPI}`)
                const data = await skeetResponse.json();
                checkResponseStatus(skeetResponse);
                addToCounter(data.thread.post.replyCount, data.thread.post.repostCount, data.thread.post.likeCount);
                getElement('stats').innerHTML = renderBskyStat(data.thread.post);
                if (replies > 0) {
                    bskyRoot.setAttribute('role', 'feed');
                    const bskyDOM =
                        typeof DOMPurify !== 'undefined'
                            ? DOMPurify.sanitize(renderSkeets(data.thread), { RETURN_DOM_FRAGMENT: true })
                            : renderSkeets(data.thread);

                    bskyRoot.appendChild(bskyDOM);
                    const bskyItems = getElements('#bsky-comments > li[data-date]');
                    sortComment(bskyItems);
                } else {
                    bskyRoot.innerHTML = i18nNocomment;
                }
                bskyCommentsLoaded = true;
                bskyRoot.setAttribute('aria-busy', 'false');
            } catch (error) {
                console.error(`Bluesky ${i18nErr}`, error);
                bskyRoot.innerHTML = `<div role="alert" class="er">[Bluesky] <br> ${i18nErr} : ${error}</div>`;
            }
        }
        respondToVisibility(bskyRoot, loadbskyAPI);
    }

    const renderBskyContent = (post) => `<div>${renderRichText(post.record)}</div>${renderBskyAttachment(post)}`;

    const renderRichText = (record) => {
        let richText = ``
        const textEncoder = new TextEncoder();
        const utf8Decoder = new TextDecoder();
        const utf8Text = new Uint8Array(record.text.length * 3);
        textEncoder.encodeInto(record.text, utf8Text);
        var charIdx = 0;
        for (const facetIdx in record.facets) {
            const facet = record.facets[facetIdx];
            const facetFeature = facet.features[0];
            const facetType = facetFeature.$type;
            var facetLink = '#';
            if (facetType == 'app.bsky.richtext.facet#tag') {
                facetLink = `https://bsky.app/hashtag/${facetFeature.tag}`;
            } else if (facetType == 'app.bsky.richtext.facet#link') {
                facetLink = facetFeature.uri;
            } else if (facetType == 'app.bsky.richtext.facet#mention') {
                facetLink = `https://bsky.app/profile/${facetFeature.did}`;
            }
            if (charIdx < facet.index.byteStart) {
                const preFacetText = utf8Text.slice(charIdx, facet.index.byteStart);
                richText += utf8Decoder.decode(preFacetText)
            }
            const facetText = utf8Text.slice(facet.index.byteStart, facet.index.byteEnd);
            richText += `<a href='${facetLink}' target='_blank' rel='external noreferrer nofollow'>` + utf8Decoder.decode(facetText) + `</a>`;
            charIdx = facet.index.byteEnd;
        }
        if (charIdx < utf8Text.length) {
            const postFacetText = utf8Text.slice(charIdx, utf8Text.length);
            richText += utf8Decoder.decode(postFacetText);
        }
        return `<p>${richText.replace(/\n/g, `<br />`)}</p>`;
    }

    const renderBskyAttachment = (post) => {
        let attachment = ``;
        if (post.embed) {
            const did = post.author.did;
            const embedType = post.embed.$type;
            if (embedType === 'app.bsky.embed.external#view') {
                const { uri, title, description, thumb } = post.embed.external;
                if (uri.includes('.gif?')) {
                    attachment = `<img src='${uri}' title='${title}' alt='${description}' loading='lazy'>`;
                } else if (thumb) {
                    attachment = `<a href='${uri}' aria-label='${title}'><img src='${thumb}' alt='${description}' loading='lazy'></a>`
                }
            } else if (embedType === 'app.bsky.embed.images#view') {
                const images = post.record.embed.images;
                attachment = images.map(image => {
                    const thumb = ToBskyImgURL(did, image.image.ref.$link, true);
                    const src = ToBskyImgURL(did, image.image.ref.$link, false);
                    return `<a href='${src}' target='_blank'><img src='${thumb}' alt='${image.alt}' loading='lazy'></a>`;
                }).join('');
            } else if (embedType === 'app.bsky.embed.video#view') {
                const video = post.record.embed.video;
                attachment = `<video controls poster='${post.embed.thumbnail}' preload='none'><source src='https://bsky.social/xrpc/com.atproto.sync.getBlob?cid=${video.ref.$link}&did=${did}' type='${video.mimeType}'></video>`
            }
            return `<div class='attachments'>${attachment}</div>`;
        }
        return attachment;
    }

    const renderBskyStat = (post) => `
        ${renderStat(post.replyCount, toBskyURL(post.uri), i18nReplies, 'replies')}
        ${renderStat(post.repostCount, `${toBskyURL(post.uri)}/reposted-by`, i18nReblogs, 'reblogs')}
        ${renderStat(post.likeCount, `${toBskyURL(post.uri)}/liked-by`, i18nFavourites, 'favourites')}
    `;

    const renderSkeet = (comment) => {
        const replyDate = new Date(comment.post.record.createdAt);
        return `
<li data-date='${toISOString(replyDate)}' id='${comment.post.cid}'>
  <article class='fed-comments bsky'>
    <span>
      <a href='${toBskyURL(comment.post.uri)}' rel='external noreferrer nofollow' aria-description='@${comment.post.author.handle}'>
        ${comment.post.author.displayName ? comment.post.author.displayName.split(" ")[0] : comment.post.author.handle.split(".")[0]} on <time datetime='${toISOString(replyDate)}'>${formatDate(replyDate)}</time>
      </a>
    </span>
    <section class='content'>${renderBskyContent(comment.post)}</section>
    <div class='contentinfo'>
      <a class='author' href='https://bsky.app/profile/${comment.post.author.handle}' rel='external noreferrer nofollow' aria-description='@${comment.post.author.handle}'>
        <img src='${comment.post.author.avatar}' width=48 height=48 alt='${comment.post.author.handle}' loading='lazy' />
      </a>
      <span class='stat'>${renderBskyStat(comment.post)}</span>
    </div>
  </article>
</li>`;}

    const renderSkeets = (thread) => {
        const node = document.createDocumentFragment();
        const createElementFromHTML = (htmlString) => {
            const li = document.createElement('li');
            li.innerHTML = htmlString.trim();
            return li.firstChild;
        }
        for (const comment of thread.replies) {
            const skeet = createElementFromHTML(renderSkeet(comment));
            if (comment.replies) {
                const reply = document.createElement('ul');
                skeet
                    .appendChild(reply)
                    .appendChild(renderSkeets(comment));
            }
            node.appendChild(skeet);
        }
        return node;
    }
}

const sortComment = (rootItem) => {
    const items = Array.from(rootItem);
    const index = new Set();
    items.sort(({ dataset: { date: a } }, { dataset: { date: b } }) => a.localeCompare(b))
    .forEach((item) => {
        if (!index.has(item.id)) {
            index.add(item.id);
            item.parentNode.appendChild(item);
        } else {
            item.remove();
        }
    });
}
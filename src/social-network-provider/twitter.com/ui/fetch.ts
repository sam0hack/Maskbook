import { bioCardSelector, selfInfoSelectors, postsContentSelector, postsImageSelector } from '../utils/selector'
import { MutationObserverWatcher } from '@holoflows/kit'
import { GroupIdentifier, ProfileIdentifier, PreDefinedVirtualGroupNames } from '../../../database/type'
import type {
    SocialNetworkUI,
    SocialNetworkUIInformationCollector,
    SocialNetworkUIDefinition,
} from '../../../social-network/ui'
import { PostInfo } from '../../../social-network/PostInfo'
import { deconstructPayload } from '../../../utils/type-transform/Payload'
import { instanceOfTwitterUI } from './index'
import { bioCardParser, postParser, postImageParser, postIdParser } from '../utils/fetch'
import { isNil } from 'lodash-es'
import Services from '../../../extension/service'
import { twitterUrl } from '../utils/url'
import { untilElementAvailable } from '../../../utils/dom'
import { injectMaskbookIconToPost } from './injectMaskbookIcon'

const resolveLastRecognizedIdentity = (self: SocialNetworkUI) => {
    const selfSelector = selfInfoSelectors().handle
    const assign = () => {
        const ref = self.lastRecognizedIdentity
        const handle = selfInfoSelectors().handle.evaluate()
        const nickname = selfInfoSelectors().name.evaluate()
        const avatar = selfInfoSelectors().userAvatar.evaluate()
        if (!isNil(handle)) {
            ref.value = {
                identifier: new ProfileIdentifier(self.networkIdentifier, handle),
                nickname,
                avatar,
            }
        }
    }
    new MutationObserverWatcher(selfSelector)
        .addListener('onAdd', () => assign())
        .addListener('onChange', () => assign())
        .startWatch({
            childList: true,
            subtree: true,
        })
}

const registerUserCollector = () => {
    new MutationObserverWatcher(bioCardSelector())
        .useForeach((cardNode: HTMLDivElement) => {
            const resolve = async () => {
                if (!cardNode) return
                const { isFollower, isFollowing, identifier, bio } = bioCardParser(cardNode)
                const myIdentities = await Services.Identity.queryMyProfiles(twitterUrl.hostIdentifier)
                const myIdentity = myIdentities[0] || ProfileIdentifier.unknown
                const myFriends = GroupIdentifier.getFriendsGroupIdentifier(
                    myIdentity.identifier,
                    PreDefinedVirtualGroupNames.friends,
                )
                const myFollowers = GroupIdentifier.getFriendsGroupIdentifier(
                    myIdentity.identifier,
                    PreDefinedVirtualGroupNames.followers,
                )
                const myFollowing = GroupIdentifier.getFriendsGroupIdentifier(
                    myIdentity.identifier,
                    PreDefinedVirtualGroupNames.following,
                )
                if (isFollower || isFollowing) {
                    if (isFollower) {
                        Services.UserGroup.addProfileToFriendsGroup(myFollowers, [identifier]).then()
                    }
                    if (isFollowing) {
                        Services.UserGroup.addProfileToFriendsGroup(myFollowing, [identifier]).then()
                    }
                    if (isFollower && isFollowing) {
                        Services.UserGroup.addProfileToFriendsGroup(myFriends, [identifier]).then()
                    }
                } else {
                    Services.UserGroup.removeProfileFromFriendsGroup(myFriends, [identifier]).then()
                }
            }
            resolve()
            return {
                onNodeMutation: resolve,
                onTargetChanged: resolve,
            }
        })
        .startWatch({
            childList: true,
            subtree: true,
        })
}

const registerPostCollector = (self: SocialNetworkUI) => {
    const getTweetNode = (node: HTMLElement) => {
        return node.closest<HTMLDivElement>(
            [
                '.tweet', // timeline page for legacy twitter
                '.main-tweet', // detail page for legacy twitter
                'article > div', // new twitter
                '[role="blockquote"]', // retweet in new twitter
            ].join(),
        )
    }

    new MutationObserverWatcher(postsContentSelector())
        .useForeach((node, _, proxy) => {
            const tweetNode = getTweetNode(node)
            if (!tweetNode) return
            const info: PostInfo = new (class extends PostInfo {
                get rootNode() {
                    return proxy.current
                }
                rootNodeProxy = proxy
                commentsSelector = undefined
                commentBoxSelector = undefined
            })()
            function run() {
                collectPostInfo(tweetNode, info, self)
                collectLinks(tweetNode, info)
            }
            run()
            info.postPayload.addListener((payload) => {
                if (!payload) return
                Services.Identity.updateProfileInfo(info.postBy.value, {
                    nickname: info.nickname.value,
                    avatarURL: info.avatarURL.value,
                }).then()
            })
            info.postPayload.value = deconstructPayload(info.postContent.value, self.payloadDecoder)
            info.postContent.addListener((newValue) => {
                info.postPayload.value = deconstructPayload(newValue, self.payloadDecoder)
            })
            injectMaskbookIconToPost(info)
            self.posts.set(proxy, info)
            return {
                onTargetChanged: run,
                onRemove: () => self.posts.delete(proxy),
                onNodeMutation: run,
            }
        })
        .setDOMProxyOption({ afterShadowRootInit: { mode: 'closed' } })
        .assignKeys((node) => {
            const tweetNode = getTweetNode(node)
            const isQuotedTweet = tweetNode?.getAttribute('role') === 'blockquote'
            return tweetNode
                ? `${isQuotedTweet ? 'QUOTED' : ''}${postIdParser(tweetNode)}${node.innerText.replace(/\s/gm, '')}`
                : node.innerText
        })
        .startWatch({
            childList: true,
            subtree: true,
        })
}

export const twitterUIFetch: SocialNetworkUIInformationCollector = {
    resolveLastRecognizedIdentity: () => resolveLastRecognizedIdentity(instanceOfTwitterUI),
    collectPeople: registerUserCollector,
    collectPosts: () => registerPostCollector(instanceOfTwitterUI),
}

function collectLinks(tweetNode: HTMLDivElement | null, info: PostInfo) {
    if (!tweetNode) return
    const links = [...tweetNode.querySelectorAll('a')].filter((x) => x.rel)
    const seen = new Set<string>(['https://help.twitter.com/using-twitter/how-to-tweet#source-labels'])
    for (const x of links) {
        if (seen.has(x.href)) continue
        seen.add(x.href)
        info.postMetadataMentionedLinks.set(x, x.href)
        Services.Helper.resolveTCOLink(x.href).then((val) => {
            if (!val) return
            info.postMetadataMentionedLinks.set(x, val)
        })
    }
}
function collectPostInfo(tweetNode: HTMLDivElement | null, info: PostInfo, self: Required<SocialNetworkUIDefinition>) {
    if (!tweetNode) return
    const { pid, content, handle, name, avatar } = postParser(tweetNode)
    if (!pid) return
    const postBy = new ProfileIdentifier(self.networkIdentifier, handle)
    info.postID.value = pid
    info.postContent.value = content
    if (!info.postBy.value.equals(postBy)) {
        info.postBy.value = postBy
    }
    info.nickname.value = name
    info.avatarURL.value = avatar || null

    // decode steganographic image
    // don't add await on this
    untilElementAvailable(postsImageSelector(tweetNode), 10000)
        .then(() => postImageParser(tweetNode))
        .then((content) => {
            if (content && info.postContent.value.indexOf(content) < 0) {
                info.postContent.value = content
            }
        })
        .catch(() => {})
}

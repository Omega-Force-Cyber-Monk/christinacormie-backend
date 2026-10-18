# BiteDrop — নতুন ইমপ্লিমেন্টেশন প্ল্যান

## ১. নিশ্চিত প্রোডাক্ট রুল

- Foodie/Customer এবং Vendor একই social feed ব্যবহার করবে।
- উভয়েই post তৈরি ও দেখা, like, comment, reply, share, follow এবং tag করতে
  পারবে।
- Foodie → Foodie, Foodie → Vendor, Vendor → Foodie এবং Vendor → Vendor follow
  করা যাবে।
- Post author শুধু নিজের followed account-গুলোকে tag করতে পারবে।
- Tag শুধু post-এ করা যাবে; comment-এ tagging থাকবে না।
- সব Foodie এবং Vendor profile public হবে।
- Follow না করলেও Foodie এবং Vendor একে অপরকে message করতে পারবে।
- একজন Vendor-এর ঠিক একটি Food Truck থাকবে।
- "Vendor Profile" বলতে Vendor-এর public Food Truck Profile বোঝাবে।
- Community question/request অপরিবর্তিত থাকবে এবং social post থেকে আলাদা হবে।

## ২. Account ও Vendor Identity

### Public identity

- Foodie identity: display name এবং user avatar।
- Vendor identity: Food Truck-এর name, image এবং profile।
- Vendor Account private থাকবে; এখানে business, subscription, payment, staff
  এবং verification data থাকবে।

### একজন Vendor, একটি Food Truck

বর্তমান database একজন Vendor-এর একাধিক Food Truck অনুমোদন করে। এটি ঠিক করতে:

- `FoodTruck.vendorId` unique করতে হবে।
- Onboarding-এর সময় `Vendor.foodTrucks`-এর পরিবর্তে singular optional
  `Vendor.foodTruck` relation রাখতে হবে।
- দ্বিতীয় draft/truck creation reject করতে হবে, concurrent request-সহ।
- Onboarding-এ existing draft create অথবা update করতে হবে।
- Unique constraint যোগ করার আগে existing data audit করতে হবে।
- যেসব code এবং response truck array ধরে নেয়, সেগুলো update করতে হবে।

`GET /api/v1/food-trucks/mine` এখন list দেয়। Compatibility-এর জন্য সাময়িকভাবে
এটি রেখে পরে singular response-এর পক্ষে deprecate করতে হবে।

## ৩. Unified Social Feed

### Post তৈরি

Foodie এবং Vendor নিচের data দিয়ে post তৈরি করতে পারবে:

- Text/caption।
- Gallery অথবা camera থেকে একাধিক image।
- একটি optional social location।
- Author-এর following list থেকে এক বা একাধিক tagged account।

Composer-এ removable image preview থাকবে। Foodie নিজের user identity দিয়ে post
করবে। Vendor স্বয়ংক্রিয়ভাবে নিজের একমাত্র Food Truck identity দিয়ে post করবে;
Flutter কোনো truck selector দেখাবে না এবং arbitrary truck ID পাঠাবে না।

Logical request shape:

```json
{
  "content": "What's on your mind?",
  "media": [
    {
      "mediaType": "IMAGE",
      "mediaUrl": "https://cdn.example.com/image.jpg",
      "sortOrder": 0
    }
  ],
  "locationId": "optional-location-uuid",
  "taggedUserIds": ["followed-user-uuid"],
  "status": "PUBLISHED"
}
```

প্রথমে image upload হবে; তারপর পাওয়া media URL post request-এ পাঠানো হবে।

### Location attachment

Composer-এর Check In একটি social location attachment; এটি verified QR check-in
নয়। তাই এটি:

- QR `CheckIn` record তৈরি করবে না।
- Loyalty point দেবে না।
- Verified visit বাড়াবে না।
- Leaderboard-এ প্রভাব ফেলবে না।

Location picker active managed location search করবে। Post response-এ selected
location-এর ID এবং display name থাকবে।

### Follow এবং tag

- সমর্থিত follow relation:
  - Foodie follows Foodie।
  - Foodie follows Vendor।
  - Vendor follows Foodie।
  - Vendor follows Vendor।
- Vendor follow করা মানে তার একমাত্র Food Truck Profile follow করা।
- Foodie ও Vendor নিজেদের সম্পূর্ণ follower list দেখতে পারবে।
- যেকোনো public Foodie/Vendor profile থেকে তার Followers এবং Following—দুই
  list-ই দেখা যাবে।
- Follower list-এ `ALL`, `CUSTOMER` ও `VENDOR` filter, search, pagination এবং
  প্রতিটি account type-এর total count থাকবে।
- প্রতিটি follower item-এ user ID, account type, display name, avatar/logo এবং
  follow relationship state থাকবে।
- Tag picker শুধু author-এর followed account দেখাবে।
- Backend unfollowed, duplicate এবং invalid tag reject করবে।
- Self-tagging অনুমোদিত হবে না।
- Published post প্রতিটি tagged account-কে একবার notify করবে; draft post কোনো
  notification পাঠাবে না।
- Tag করার পর author account-টি unfollow করলেও existing tag থাকবে।

### Profile post tab

- বাম পাশের grid tab-এ profile owner-এর নিজের post দেখাবে।
- ডান পাশের tag tab-এ অন্যদের visible post দেখাবে, যেখানে profile owner tagged।
- এই নিয়ম Foodie এবং Vendor উভয় profile-এর জন্য প্রযোজ্য।
- Tagged post-এর ownership original author-এর থাকবে; tagged profile edit/delete
  permission পাবে না।
- Draft, hidden, archived, removed অথবা inaccessible post Tagged tab-এ দেখাবে
  না।

### Profile grid ও post navigation

প্রস্তাবিত flow:

1. Profile grid-এ প্রতিটি post-এর একটি thumbnail দেখাবে; প্রথম media cover হবে।
2. Thumbnail tap করলে standalone image নয়, Post Detail screen খুলবে।
3. Post Detail-এ author, caption, location, tagged accounts, সব media, like,
   comment এবং share action থাকবে।
4. Post Detail-এর media tap করলে full-screen viewer খুলবে। Back করলে Post
   Detail, আবার back করলে আগের scroll position-সহ Profile grid দেখাবে।

Multi-image post-এর thumbnail-এ carousel indicator থাকবে। Post Detail এবং
full-screen viewer-এ সব media swipe করা যাবে। Text-only post-এর জন্য non-image
grid card অথবা placeholder রাখতে হবে।

Deep link এবং shared link post ID দিয়ে সরাসরি Post Detail খুলবে। Backend detail
দেওয়ার আগে visibility যাচাই করবে। Missing, removed অথবা inaccessible post-এর
cached content Flutter দেখাবে না।

### Data পরিবর্তন

- `Post.authorUserId -> User` relation যোগ করতে হবে।
- Foodie post-এর জন্য `Post.vendorId` এবং `Post.foodTruckId` nullable করতে হবে।
- Vendor post-এ automatically resolved `vendorId` ও `foodTruckId` থাকবে।
- Existing Vendor post-এ `authorUserId` backfill করতে হবে।
- Existing Food Truck follow রেখে Foodie-to-Foodie/Vendor account follow support
  যোগ করতে হবে।
- Post ও tagged user-এর মধ্যে unique post-tag relation যোগ করতে হবে।
- Social location-এর জন্য Admin-managed `Place` model যোগ করতে হবে; এতে name,
  address, coordinates, optional Market relation এবং active status থাকবে।

### API পরিবর্তন

- `POST /api/v1/social/posts`-এ `CUSTOMER` ও `VENDOR` অনুমোদন করতে হবে।
- Create/update post request-এ `taggedUserIds` ও `locationId` যোগ করতে হবে।
- `GET /api/v1/social/posts/mine` উভয় account type-এর জন্য চালু করতে হবে।
- `authorUserId` দিয়ে update/delete authorization করতে হবে; Admin moderation
  অপরিবর্তিত থাকবে।
- Foodie ও Vendor profile-এর follow/unfollow এবং paginated followed-account
  search যোগ করতে হবে।
- উভয় account type-এর জন্য `ALL`, `CUSTOMER`, `VENDOR` filter এবং per-type count
  সহ paginated Followers ও Following endpoint যোগ করতে হবে। এগুলো public
  profile থেকেও দেখা যাবে।
- Admin-এর জন্য social Place create/update/activate/deactivate API এবং app-এর
  জন্য searchable active Place list API যোগ করতে হবে।
- Profile-এর দুই tab-এর জন্য paginated authored-post ও tagged-post endpoint
  যোগ করতে হবে।
- Post Detail ও deep link-এর জন্য `GET /api/v1/social/posts/:postId` যোগ করতে
  হবে। এতে author, caption, ordered media, location, tags, engagement count,
  viewer state এবং comment preview থাকবে।
- Profile grid response lightweight হবে: post ID, cover thumbnail, media
  count/type এবং visibility data। Tap করার পর complete post load হবে।
- Post/feed response-এ normalized `author`, `taggedAccounts` এবং optional
  `location` থাকবে।
- Share link তৈরির জন্য food-truck slug বাধ্যতামূলক রাখা যাবে না।

### Validation

- Text অথবা অন্তত একটি image বাধ্যতামূলক।
- Text trim এবং text/media validate করতে হবে।
- Caption সর্বোচ্চ 2,200 character হবে।
- প্রতি post-এ সর্বোচ্চ 10টি image, প্রতি image সর্বোচ্চ 10 MB এবং সর্বোচ্চ 20টি
  tagged account নেওয়া যাবে। Backend ও Flutter একই limit enforce করবে।
- সর্বোচ্চ একটি active location নেওয়া যাবে।
- Duplicate tag ঠেকাতে এবং followed-account tagging enforce করতে হবে।
- Like idempotent থাকবে এবং existing ownership/moderation rule বজায় থাকবে।
- Hidden, archived, removed অথবা draft post public feed-এ দেখাবে না।

## ৪. Direct Messaging

সমর্থিত conversation:

- Foodie থেকে Foodie।
- Foodie থেকে Vendor।
- Vendor থেকে Foodie।
- Vendor থেকে Vendor।

Messaging অথবা recipient search-এর জন্য follow করা কখনো বাধ্যতামূলক নয়।
Unfollowed sender-এর প্রথম message সরাসরি inbox-এ না গিয়ে Message Requests-এ
যাবে। Recipient request accept, decline অথবা sender-কে block করতে পারবে। এটি
open messaging বজায় রেখে spam কমাবে।

বর্তমান messaging module `participantUserId`, `vendorId` অথবা `foodTruckId`
দিয়ে authenticated direct conversation support করে। এটি রেখে নিচের alignment
করতে হবে:

- `participantUserId` canonical recipient ID হবে।
- Vendor/Food Truck target Vendor owner user-এ resolve হবে।
- একই দুই user-এর unordered pair-এর জন্য একটি direct conversation reuse হবে।
- সব active Foodie ও Vendor-এর ওপর paginated recipient search যোগ করতে হবে।
- Normalized participant type, name এবং avatar/logo return করতে হবে।
- Profile, post, comment এবং tagged account থেকে chat শুরু করা যাবে।
- Recipient sender-কে follow না করলে conversation `REQUESTED` অবস্থায় থাকবে;
  accept করলে `ACTIVE` হবে। Reply করলে request automatically accepted হবে।
- Request accept হওয়ার আগে sender শুধু একটি initial text message পাঠাতে পারবে;
  image/file attachment পাঠাতে পারবে না।
- User কোনো নির্দিষ্ট account block/unblock করতে পারবে। Blocked account follow,
  tag অথবা নতুন message পাঠাতে পারবে না; existing history delete হবে না।
- Globalভাবে unfollowed account-এর message বন্ধ করার setting থাকবে না; Message
  Requests এবং individual block ব্যবহার হবে।
- Self-chat এবং inactive, suspended, blocked, deactivated অথবা deleted
  participant reject করতে হবে।
- Participant authorization, Socket.IO delivery, unread count, read marker,
  mute behavior, attachment এবং notification অপরিবর্তিত রাখতে হবে।
- Conversation request status, block relation এবং accept/decline/block API যোগ
  করতে হবে। Request notification normal chat notification থেকে আলাদা হবে।

## ৫. Community Module

এই plan-এ Community behavior-এর কোনো পরিবর্তন নেই।

- Community question/request-এর existing API, payload, permission, category,
  status, media, comment, reaction, report, interest, ignore action, Vendor
  offer এবং moderation behavior অপরিবর্তিত থাকবে।
- Community record social `Post` record থেকে আলাদা থাকবে।
- Social tagging, following এবং location change Community-তে প্রযোজ্য হবে না।

## ৬. Migration-এর ক্রম

1. একাধিক Food Truck আছে এমন Vendor audit করে conflict resolve করতে হবে।
2. Vendor/Food Truck unique constraint যোগ করতে হবে।
3. Nullable post author, tag, follow ও location structure যোগ করতে হবে।
4. Existing Vendor post-এর author backfill করতে হবে।
5. Backend read/write এবং API response update করতে হবে।
6. নতুন response contract stable হওয়ার পর Flutter update করতে হবে।
7. Backfill verify করার পর `Post.authorUserId` required করতে হবে।
8. পুরোনো plural Vendor-truck contract নিরাপদভাবে deprecate করতে হবে।

Existing post, like, comment, save, counter, chat এবং Community record অক্ষত
রাখতে হবে।

## ৭. Acceptance Test

- Foodie ও Vendor text-only, image-only এবং mixed post তৈরি করতে পারে।
- Vendor post সবসময় Vendor-এর একমাত্র Food Truck identity ব্যবহার করে।
- Author শুধু নিজের post update/delete করতে পারে; Admin moderation কাজ করে।
- উভয় account type post দেখা, like, comment, reply এবং share করতে পারে।
- শুধু followed account tag করা যায়; duplicate tag/notification তৈরি হয় না।
- Foodie ও Vendor public profile থেকে Followers/Following দেখতে এবং
  Customer/Vendor দিয়ে filter করতে পারে; pagination-এ item বাদ বা duplicate হয়
  না।
- Profile grid-এ authored post এবং tag tab-এ visible tagged post দেখা যায়।
- Profile thumbnail tap করলে সঠিক Post Detail খোলে; media tap করলে full-screen
  viewer খোলে এবং back navigation profile position ধরে রাখে।
- Social location QR check-in, point, visit অথবা leaderboard প্রভাবিত করে না।
- Concurrent request দিয়েও Vendor দ্বিতীয় Food Truck তৈরি করতে পারে না।
- Follow ছাড়াই চার ধরনের Foodie/Vendor messaging combination কাজ করে।
- Unfollowed sender-এর message request হিসেবে আসে; accept/reply করার আগে
  অতিরিক্ত message বা attachment পাঠানো যায় না।
- Blocked account follow, tag অথবা message করতে পারে না এবং unblock কাজ করে।
- একই দুই user-এর duplicate direct conversation তৈরি হয় না।
- Non-participant conversation message পড়তে বা পাঠাতে পারে না।
- Existing Community flow regression test-এ অপরিবর্তিত থাকে।

## ৮. প্রস্তাবনা

- Message block-এর পাশাপাশি abuse report ও Admin review flow যোগ করা।
- Feed, follow, tag, search ও messaging-এর জন্য Foodie/Vendor-এর একটি normalized
  public-profile response ব্যবহার করা।
- Verified QR check-in-এর সঙ্গে বিভ্রান্তি এড়াতে code-এ social check-in-কে
  location attachment নামে রাখা।
- শুধু service validation-এর ওপর নির্ভর না করে Vendor/Food Truck এবং post-tag
  uniqueness database constraint দিয়ে enforce করা।
- Existing Flutter application silently না ভেঙে changed response contract
  version অথবা deprecate করা।

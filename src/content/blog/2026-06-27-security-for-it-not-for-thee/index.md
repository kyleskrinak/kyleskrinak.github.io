---
title: "Security for IT, Not for Thee"
pubDate: 2026-06-27T00:00:00.000Z
description: "I tried to log into Google on a company iPad. Two hours later I had rebuilt my account security from scratch. Here is why the average person never gets that far."
image: ./2026-06-27-dore-gate-of-hell.webp
alt: Gustave Doré engraving of the Gate of Hell from Dante's Inferno
caption: Gustave Doré, "The Gate of Hell," illustration for Dante's Inferno, 1861. I only wanted to learn Hungarian.
tags:
  - security
  - passkeys
  - personal
---

I have a Saturday morning routine: me time with my laptop, and otherwise what I do is at my whim. This morning I'd decided to spend two minutes of it on Hungarian. I'd just gotten Duolingo, so I opened the app on my work iPad. It asked me to sign in. I did not want to make a new account — I have enough of those — so in my laziness, I chose to sign in with Google. Faster, fewer passwords, one less thing to remember. That was the whole ambition.

The iPad could not do it. I'd run into this passkey wall before and given up due to time, but this morning I had the time, so I decided to actually troubleshoot it. In my mind, I had 118 minutes remaining. What I found turned a two-minute convenience into a full burn of my morning's discretionary time. By the end I had replaced a roughly six-year-old authenticator I no longer controlled, moved my second factor into a password manager, and finally figured out what to actually do with backup codes, the ones I'd known existed but never had a practical strategy for storing. None of that was the goal. All of it was the cost of the goal.

If you're starting to get uncomfortable reading this, or you don't recognize the concepts I'm naming, that discomfort is the point. You don't need to follow the technical specifics.

I do this for a living. I've been in IT since 1989. And this still ate a morning. Hold that thought, because it is the entire point.

## The thing that broke

Passkeys are the contemporary standard for login security now. On the iPad, Google shows a passkey QR code. You scan it with your phone, your phone proves it is you, and the tablet lets you in. Clean, modern, phishing-resistant. When it works.

It did not work. I scanned the code. My phone sat on "Connecting…" and never moved. The iPad timed out. Try again, same result.

So I did what the job has trained me to do. I fired up Claude Opus 4.8 to help guide me through isolation.

Bluetooth on, both devices, confirmed, and the passkey flow uses Bluetooth proximity, not the device pairing I tested, but ruling out dead radios is free. Phone on cellular only, off my home network, in case something local was eating the relay traffic, still hung. Phone's Bluetooth toggled off and back on to clear stale state, still hung. Every test I ran changed something on the phone. None of them touched the iPad. That was the tell.

The specifics don't matter. Let them flow past. The point is I changed variables one at a time until I isolated where the problem lived.

I proved the phone was fine by using it to log into Google on my Mac instead. Scanned that QR, my password manager answered, signed in clean. The phone's machinery worked end to end. The fault lived on the iPad.

## The fault was a switch I am not allowed to touch

On the iPad: Settings, General, AutoFill Passwords and Passkeys. Disabled. I tapped it. Nothing. Greyed out, unresponsive, enforced by the device management profile my employer controls.

That is the whole bug. The iPad cannot resolve a passkey because the setting that lets it has been switched off at the policy level, and I cannot switch it back. There is a coherent reason for the lockdown, companies want every credential touching their systems to live somewhere they can see and revoke, and an unmanaged passkey in a personal vault is exactly what that policy exists to prevent. The reasoning is sound. The result is still a tablet that cannot log into my own Google account.

The fix is a support ticket. Filing it opens a can of worms not worth the trouble, anyone inside a managed environment knows the calculus. So I did what most people do when the front door is locked. I went looking for a side door.

## The side door, and the rot behind it

You can get past the passkey screen. "Try another way" lists the other methods on your account. I picked the prompt to my phone, tapped yes, and Google asked for a code from my authenticator app.

I opened the app. My Google account was not in it.

This is where a normal person quits. Not out of laziness, out of a reasonable belief that they have done something wrong. I had not. The account showed an authenticator added roughly six years ago. The secret was registered on Google's side, but the app that once held it was a phone I threw away years ago. Google remembered the enrollment. I no longer held the key. The two had quietly drifted apart, and that was on me to track. In personal security, we take a lot of details for granted, and this was one of them.

I got in through a code sent to my email, which is the fallback that actually worked when everything fancier failed. Worth sitting with that. The oldest, plainest method in the list is the one that carried me.

## So I rebuilt the thing properly

Once I was in, I stopped routing around the problem and fixed the foundation.

I moved my Google second factor into my password manager. The same rotating six-digit code an authenticator app generates — a TOTP, time-based one-time password — can live as a field on the login itself, syncing to every device I own. I had been on the free tier for years. I upgraded to Premium, something I had meant to do for ages and never had a reason urgent enough. A locked iPad turned out to be the reason.

It did not go smoothly, because nothing here does. The desktop app threw an "out of date" error and refused to save, repeated syncs did not clear it, and the web interface, my idea, sidestepped the whole jam by reading straight from the server. I pasted in the setup key Google handed me, watched a fresh code start rotating, and entered that code back into Google to make the switch real. The roughly six-year-old ghost authenticator got replaced in the same motion.

Then the backup codes. Google had a set, created about eleven years ago. Nine of ten unused, and stored nowhere I could find, which means they were not a backup at all. I regenerated them and hit the genuine question: where do you put the keys to the account that is itself the key to everything else? Not in my wallet, where a thief gets my whole life. Not in the same vault as everything else, which would collapse every factor into one basket. I put them in an encrypted note locked behind my login password and a fingerprint, independent of the vault, independent of plain cloud sync.

## The part that should make you think

Add it up. To log into Google on a tablet, I:

- isolated a Bluetooth-versus-network-versus-device fault by elimination
- recognized a management-profile lockdown by the way a toggle refused to move
- diagnosed a roughly six-year-old orphaned authenticator from a single date string
- recovered through an email fallback most people forget they have
- bought, troubleshot, and configured a password manager mid-task
- worked around a desktop sync bug by switching to the web client
- made a real decision about where to store recovery codes under a real threat model

Every one of those steps required knowledge the average person has no reason to own. Not because they are incapable, because nobody ever taught them, and the systems are built as if everyone already knows. The error messages explain nothing. The orphaned authenticator announces nothing. The locked setting gives no reason. At each step the path of least resistance is to give up and accept whatever weak, half-broken security you are left holding.

That is the actual state of security for an ordinary person. Not that the tools are bad, passkeys are good, code-based two-factor is good, encrypted notes are good. The tools are fine. The problem is that using them correctly demands a morning, a profession, and a stubbornness most people have no reason to bring to the task. Modern security has become unwieldy by necessity, layered to the point where understanding it requires sustained attention most people can't afford. So they do not. They reuse a password, skip the second factor, leave the recovery codes in an email folder, and hope.

I had every advantage walking in, and it still cost me two hours. Ask yourself what it costs someone who does not do this for a living. The system failed them first. But at some point you have to reckon with putting your life into a system you don't understand. That's not a failure of effort. It's a failure of judgment, and the cost is jeopardy.

Here is the part worth sitting with. When I finally went to make my Duolingo account, the entire reason this started, the app did not offer "sign in with Google" at all. I made a unique account in ninety seconds. The thing I spent two hours clearing the path for was never on the menu.

So by the strict accounting, the morning bought nothing for Duolingo. I could have made that account first and gone about my day. But the errand was never really the point, it was the tripwire. It exposed an account security setup that was quietly rotting: an authenticator I had not controlled in six years, backup codes lost for roughly eleven, a vault I had never bothered to upgrade, no consolidation, a single Google login holding up more than it should. I would have hit all of that eventually, at a worse moment, with more than a language app on the line. The trivial task was the canary.

And that is exactly why this is lost on most people. In my shoes, the average person makes the unique account in the first ninety seconds, the smart, efficient move, and never discovers the orphaned authenticator, the dead codes, the single point of failure. They get the convenience and keep the rot. They are not wrong to take the easy exit. The easy exit is reasonable. It just quietly leaves them exposed.

That is the real problem. It is that finding out your security is broken requires you to be stubborn enough to chase a dead login down a hole you had no reason to enter, and to know what you are looking at when you get to the bottom. Almost nobody is.

I still cannot log into Google on that iPad the easy way, and I never needed to. But everything behind it is finally built right, and I have the framework to migrate the rest of my TOTP accounts into my password manager. The wild goose chase caught no goose. It was a productive two hours, though, and it exposed exactly why most people never get here. An IT person with thirty-seven years in the field spent a morning rewiring multiple security paradigms to fix something that should have been simple. Each new simplified standard compounds on the last, and the average user is left managing a bewildering array of authentication methods that were each supposed to make things easier. A normie would have made the unique account in ninety seconds and never looked back. Quicker. Easier. And they may be unaware of how exposed that choice leaves them.

The unique account took ninety seconds. Then Duolingo opened to the first lesson, and I finally spent the two minutes I came for.

Now. How do you say "the boy and the girl" in Hungarian?

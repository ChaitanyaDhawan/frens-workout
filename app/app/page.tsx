"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthProvider } from "@/app/lib/auth";
import { StoreProvider, useStore } from "@/app/lib/store";
import AuthGate from "@/app/components/AuthGate";
import Header from "@/app/components/Header";
import StatsTile from "@/app/components/StatsTile";
import Feed from "@/app/components/Feed";
import Board from "@/app/components/Board";
import You from "@/app/components/You";
import DemoButton from "@/app/components/DemoButton";
import HoldPlate from "@/app/components/HoldPlate";
import ScrollArea from "@/app/components/ScrollArea";
import TabBar from "@/app/components/TabBar";
import Toast from "@/app/components/Toast";
import DetailSheet from "@/app/components/DetailSheet";
import DayDetailSheet from "@/app/components/DayDetailSheet";
import CommentSheet from "@/app/components/CommentSheet";
import KudosSheet from "@/app/components/KudosSheet";
import AutoLogSheet from "@/app/components/AutoLogSheet";
import ProfileSheet from "@/app/components/ProfileSheet";
import Celebration from "@/app/components/Celebration";
import KudosReceived from "@/app/components/KudosReceived";
import ParticleCanvas from "@/app/components/ParticleCanvas";
import InstallGuide from "@/app/components/InstallGuide";
import BackgroundPicker from "@/app/components/BackgroundPicker";
import Splash from "@/app/components/Splash";
import NotificationPrompt from "@/app/components/NotificationPrompt";

function Home() {
  return (
    <div className="view active" id="view-home">
      <StatsTile />
      <div className="sect-h">
        <h2>Dispatches</h2>
        <div className="ln" />
      </div>
      <Feed />
    </div>
  );
}

function Shell() {
  const { tab, sheet, daySheet, commentSheet, kudosSheet, autoLog, profileMember, closeSheet, closeDaySheet, closeCommentSheet, closeKudosSheet, closeAutoLog, closeProfile } =
    useStore();
  const overlayOpen = !!sheet || !!daySheet || !!commentSheet || !!kudosSheet || autoLog || !!profileMember;

  return (
    <>
      <div className="phone">
        <div className="safe-top" aria-hidden />
        <ScrollArea>
          {tab !== "board" && <Header />}
          {tab === "home" && <Home />}
          {tab === "board" && (
            <div className="view active" id="view-board">
              <Board />
            </div>
          )}
          {tab === "you" && (
            <div className="view active" id="view-you">
              <You />
            </div>
          )}
        </ScrollArea>
        <DemoButton />
        <HoldPlate />
        <TabBar />
      </div>

      <Toast />

      <NotificationPrompt />

      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => {
              closeSheet();
              closeDaySheet();
              closeCommentSheet();
              closeKudosSheet();
              closeAutoLog();
              closeProfile();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{sheet && <DetailSheet key="detail-sheet" />}</AnimatePresence>
      <AnimatePresence>{daySheet && <DayDetailSheet key="day-sheet" />}</AnimatePresence>
      <AnimatePresence>{commentSheet && <CommentSheet key="comment-sheet" />}</AnimatePresence>
      <AnimatePresence>{kudosSheet && <KudosSheet key="kudos-sheet" />}</AnimatePresence>
      <AnimatePresence>{autoLog && <AutoLogSheet key="autolog-sheet" />}</AnimatePresence>
      <AnimatePresence>{profileMember && <ProfileSheet key="profile-sheet" />}</AnimatePresence>

      <Celebration />
      <KudosReceived />

      <ParticleCanvas />
    </>
  );
}

export default function Page() {
  // Splash approved — on for everyone (~1.25s cold-open title card).
  const SPLASH_ENABLED = true;

  // ?demo=1 — no-login sample-data mode, for launch/marketing screenshots of the
  // current app. Never reachable in the normal flow.
  const [demo, setDemo] = useState(false);
  const [splashPreview, setSplashPreview] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.has("demo")) setDemo(true);
    if (p.has("splash")) setSplashPreview(true); // ?splash=1 → preview the splash for approval
  }, []);

  if (demo) {
    return (
      <AuthProvider>
        <BackgroundPicker />
        <StoreProvider demo>
          <Shell />
        </StoreProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      {/* Cold-start title card — overlays everything (including the auth
          gate) and dismisses itself on a timer. */}
      {(SPLASH_ENABLED || splashPreview) && <Splash />}
      {/* Outside the gate so these show on every screen, including the
          signed-out sign-in screen (install-first, then sign in). */}
      <BackgroundPicker />
      <InstallGuide />
      <AuthGate>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </AuthGate>
    </AuthProvider>
  );
}

"use client";

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
import TabBar from "@/app/components/TabBar";
import Toast from "@/app/components/Toast";
import DetailSheet from "@/app/components/DetailSheet";
import DayDetailSheet from "@/app/components/DayDetailSheet";
import ParticleCanvas from "@/app/components/ParticleCanvas";

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
  const { tab, sheet, daySheet, closeSheet, closeDaySheet } = useStore();
  const overlayOpen = !!sheet || !!daySheet;

  return (
    <>
      <div className="phone">
        <Header />
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
        <DemoButton />
        <HoldPlate />
        <TabBar />
      </div>

      <Toast />

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
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{sheet && <DetailSheet key="detail-sheet" />}</AnimatePresence>
      <AnimatePresence>{daySheet && <DayDetailSheet key="day-sheet" />}</AnimatePresence>

      <ParticleCanvas />
    </>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <AuthGate>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </AuthGate>
    </AuthProvider>
  );
}

"use client";

import { useMemo, useState } from "react";
import { LANGUAGES, TOPICS } from "@/lib/constants";
import { SupabaseTrackerRepository } from "@/lib/repository/tracker-repository";
import { createClient } from "@/lib/supabase/client";
import type { Difficulty } from "@/types/database";
import type { Profile } from "@/types/models";

const timezones = [
  "UTC", "Asia/Calcutta", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "Australia/Sydney",
];
const rank = { easy: 0, medium: 1, hard: 2 };

export function PlannerSettings({ userId, email, initialProfile }: {
  userId: string; email: string; initialProfile: Profile;
}) {
  const repository = useMemo(() => new SupabaseTrackerRepository(createClient()), []);
  const [profile, setProfile] = useState(initialProfile);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const toggle = (field: "active_topics" | "preferred_languages", value: string) => {
    setProfile((current) => {
      const values = current[field];
      return { ...current, [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
    setState("idle");
  };
  const save = async () => {
    if (!profile.active_topics.length) return setMessage("Choose at least one active topic.");
    if (!profile.preferred_languages.length) return setMessage("Choose at least one preferred language.");
    if (rank[profile.difficulty_min] > rank[profile.difficulty_max]) return setMessage("Minimum difficulty cannot exceed maximum difficulty.");
    setState("saving"); setMessage("");
    try {
      const saved = await repository.updateProfile(userId, {
        display_name: profile.display_name.trim(),
        daily_target: profile.daily_target,
        timezone: profile.timezone,
        active_topics: profile.active_topics,
        preferred_languages: profile.preferred_languages,
        difficulty_min: profile.difficulty_min,
        difficulty_max: profile.difficulty_max,
      });
      setProfile(saved); setState("saved"); setMessage("Practice settings saved. They will shape the next generated queue.");
    } catch (cause) {
      setState("error"); setMessage(cause instanceof Error ? cause.message : "Could not save settings.");
    }
  };

  return <section className="panel settings-panel">
    <div className="settings-section"><div><h2>Profile</h2><p>Your personal workspace identity.</p></div><div className="settings-fields"><label><span>Display name</span><input value={profile.display_name} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} /></label><label><span>Email</span><input value={email} readOnly /></label></div></div>
    <div className="settings-section"><div><h2>Daily plan</h2><p>Generated on your first visit of each local calendar day.</p></div><div className="settings-fields two">
      <label><span>Daily target</span><input type="number" min="1" max="8" value={profile.daily_target} onChange={(event) => setProfile({ ...profile, daily_target: Number(event.target.value) })} /></label>
      <label><span>Timezone</span><select value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}>{!timezones.includes(profile.timezone) && <option>{profile.timezone}</option>}{timezones.map((timezone) => <option key={timezone}>{timezone}</option>)}</select></label>
      <label><span>Minimum difficulty</span><select value={profile.difficulty_min} onChange={(event) => setProfile({ ...profile, difficulty_min: event.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
      <label><span>Maximum difficulty</span><select value={profile.difficulty_max} onChange={(event) => setProfile({ ...profile, difficulty_max: event.target.value as Difficulty })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
    </div></div>
    <div className="settings-section"><div><h2>Active topics</h2><p>Weak problems in these topics receive priority.</p></div><div className="choice-pills">{TOPICS.map((topic) => <button type="button" className={profile.active_topics.includes(topic) ? "active" : ""} onClick={() => toggle("active_topics", topic)} key={topic}>{topic}</button>)}</div></div>
    <div className="settings-section"><div><h2>Preferred languages</h2><p>Your primary languages for practice and saved solutions.</p></div><div className="choice-pills">{LANGUAGES.map((language) => <button type="button" className={profile.preferred_languages.includes(language) ? "active" : ""} onClick={() => toggle("preferred_languages", language)} key={language}>{language}</button>)}</div></div>
    {message && <p className={`form-message ${state === "error" ? "error" : "success"}`}>{message}</p>}
    <div className="settings-save"><button className="button button-primary" disabled={state === "saving"} onClick={save}>{state === "saving" ? "Saving…" : "Save practice settings"}</button></div>
  </section>;
}

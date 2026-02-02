"use client";

import Link from "next/link";
import { IoNotifications } from "react-icons/io5";
import { FaUser } from "react-icons/fa6";
import { FcFilmReel } from "react-icons/fc";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import SignOut from "../buttons/signOut";
import BurgerMenu from "./BurgerMenu";
import DropdownMenu from "./dropDownMenu";
import MessageButton from "./MessageButton";
import SearchBar from "./searchBar";

// Define the User type based on your Supabase "users" table structure
interface User {
  id: string;
  username?: string;
  [key: string]: any; // Flexible for additional fields
}

type NavbarStatus = "loading" | "anon" | "needs_profile" | "ok";

export function LogedNavbar() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<NavbarStatus>("loading");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/navbar", {
          credentials: "include", // Include cookies for auth
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Navbar request failed: ${response.status}`);
        }
        const data = await response.json();
        const nextStatus = (data?.status ?? "anon") as NavbarStatus;
        setStatus(nextStatus);
        setUser(data?.user ?? null);
      } catch (error) {
        console.error("Failed to fetch user:", error);
        setUser(null);
        setStatus("anon");
      }
    };

    fetchUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div className="max-w-[1520px] w-full m-auto flex flex-row items-center justify-between text-white p-3 h-full">
        <div>
          <Link className="font-bold text-md md:text-xl sm:ml-5" href="/app">
            Let's see
          </Link>
        </div>
        <div className="flex flex-row gap-3 items-center">
          <div className="animate-pulse bg-neutral-700 w-20 h-10 rounded-md"></div>
          <div className="animate-pulse bg-neutral-700 w-20 h-10 rounded-md"></div>
        </div>
      </div>
    );
  }

  const isAuthed = status === "ok" || status === "needs_profile";
  const isProfileReady = status === "ok";

  return (
    <div className="max-w-[1520px] w-full m-auto flex flex-row items-center justify-between text-white p-3 h-full">
      <div>
        <Link className="font-bold text-md md:text-xl sm:ml-5" href="/app">
          Let's see
        </Link>
      </div>

      <div className="flex flex-row gap-3 items-center">
        {isAuthed && (
          <Link
            className="flex items-center justify-center px-4 py-2 rounded-md bg-neutral-600 hover:bg-neutral-500 relative"
            href="/app/reel"
          >
            <FcFilmReel />
          </Link>
        )}
        {isProfileReady && user && <MessageButton userId={user.id} />}
        {isProfileReady && user && (
          <Link
            className="hidden md:flex items-center justify-center px-4 py-2 rounded-md bg-neutral-600 hover:bg-neutral-500 relative"
            href="/app/notification"
          >
            <IoNotifications />
            {/* <RealtimeNotification userId={user.id} /> */}
          </Link>
        )}
        {isAuthed && (
          <Link
            className="flex items-center justify-center px-4 py-2 rounded-md bg-neutral-600 hover:bg-neutral-500 relative"
            href={isProfileReady ? "/app/profile" : "/app/profile/setup"}
          >
            <FaUser />
          </Link>
        )}
        {isProfileReady && <SearchBar />}
        <div className="hidden md:flex flex-row gap-3 items-center">
          {status === "anon" && (
            <Link
              className="flex text-nowrap items-center text-gray-100 justify-center px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 relative"
              href="/login"
            >
              Log in
            </Link>
          )}
          {status === "anon" && (
            <Link
              className="flex text-nowrap items-center text-gray-100 justify-center px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 relative"
              href="/signup"
            >
              Sign up
            </Link>
          )}
          {status === "needs_profile" && (
            <>
              <Link
                className="flex text-nowrap items-center text-gray-100 justify-center px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 relative"
                href="/app/profile/setup"
              >
                Complete Profile
              </Link>
              <div className="min-w-[140px]">
                <SignOut />
              </div>
            </>
          )}
          {status === "ok" && user && <DropdownMenu user={user} />}
        </div>
        <BurgerMenu status={status} username={user?.username} />
      </div>
    </div>
  );
}

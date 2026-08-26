"use client";
import Link from "@components/ui/AppLink";
import React, { useState } from "react";

interface pageProps {
  message: string;
}

/**
 * Named `logornot` until the linter could see it.
 *
 * React decides what is a component by the *call site* — `<Logornot />` is a
 * component, `<logornot />` is an unknown HTML tag — and the profile page
 * imports the default export under a capital, so this always rendered
 * correctly. But react-hooks cannot see through a default import to the alias,
 * so a lowercase declaration reads as "hooks called outside a component" and
 * the rule fires on a file that works. Renaming the declaration is the honest
 * fix; the alias was doing the work.
 */
function Logornot({ message }: pageProps) {
  const [modal, setModal] = useState(false);
  const onClose = () => {
    setModal(!modal);
  };
  return (
    <>
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9999]">
          <div className="bg-surface-700 w-full h-fit max-w-3xl sm:rounded-lg p-5 shadow-xl">
            <div className="flex justify-between items-center p-4 border-b">
              <Link
                className="bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-2 text-white text-lg font-semibold"
                href={"/login"}
              >
                Log in
              </Link>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300"
              >
                ✖
              </button>
            </div>
            <div className="p-4">
              <p className="text-white">{message}</p>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={onClose}
        className="px-4 py-2 bg-surface-700 text-white rounded-md  transition-colors"
      >
        Message
      </button>
    </>
  );
}

export default Logornot;

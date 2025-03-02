/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef KeyboardLayout_h__
#define KeyboardLayout_h__

#include "mozilla/RefPtr.h"
#include "nscore.h"
#include "nsString.h"
#include "nsWindowBase.h"
#include "nsWindowDefs.h"
#include "mozilla/Attributes.h"
#include "mozilla/EventForwards.h"
#include "mozilla/TextEventDispatcher.h"
#include "mozilla/widget/WinMessages.h"
#include "mozilla/widget/WinModifierKeyState.h"
#include <windows.h>

#define NS_NUM_OF_KEYS          70

#define VK_OEM_1                0xBA   // ';:' for US
#define VK_OEM_PLUS             0xBB   // '+' any country
#define VK_OEM_COMMA            0xBC
#define VK_OEM_MINUS            0xBD   // '-' any country
#define VK_OEM_PERIOD           0xBE
#define VK_OEM_2                0xBF
#define VK_OEM_3                0xC0
// '/?' for Brazilian (ABNT)
#define VK_ABNT_C1              0xC1
// Separator in Numpad for Brazilian (ABNT) or JIS keyboard for Mac.
#define VK_ABNT_C2              0xC2
#define VK_OEM_4                0xDB
#define VK_OEM_5                0xDC
#define VK_OEM_6                0xDD
#define VK_OEM_7                0xDE
#define VK_OEM_8                0xDF
#define VK_OEM_102              0xE2
#define VK_OEM_CLEAR            0xFE

class nsIIdleServiceInternal;

namespace mozilla {
namespace widget {

static const uint32_t sModifierKeyMap[][3] = {
  { nsIWidget::CAPS_LOCK, VK_CAPITAL, 0 },
  { nsIWidget::NUM_LOCK,  VK_NUMLOCK, 0 },
  { nsIWidget::SHIFT_L,   VK_SHIFT,   VK_LSHIFT },
  { nsIWidget::SHIFT_R,   VK_SHIFT,   VK_RSHIFT },
  { nsIWidget::CTRL_L,    VK_CONTROL, VK_LCONTROL },
  { nsIWidget::CTRL_R,    VK_CONTROL, VK_RCONTROL },
  { nsIWidget::ALT_L,     VK_MENU,    VK_LMENU },
  { nsIWidget::ALT_R,     VK_MENU,    VK_RMENU }
};

class KeyboardLayout;

struct UniCharsAndModifiers
{
  // Dead-key + up to 4 characters
  char16_t mChars[5];
  Modifiers mModifiers[5];
  uint32_t  mLength;

  UniCharsAndModifiers() : mLength(0) {}
  UniCharsAndModifiers operator+(const UniCharsAndModifiers& aOther) const;
  UniCharsAndModifiers& operator+=(const UniCharsAndModifiers& aOther);

  /**
   * Append a pair of unicode character and the final modifier.
   */
  void Append(char16_t aUniChar, Modifiers aModifiers);
  void Clear() { mLength = 0; }
  bool IsEmpty() const { return !mLength; }

  void FillModifiers(Modifiers aModifiers);

  bool UniCharsEqual(const UniCharsAndModifiers& aOther) const;
  bool UniCharsCaseInsensitiveEqual(const UniCharsAndModifiers& aOther) const;

  nsString ToString() const { return nsString(mChars, mLength); }
};

struct DeadKeyEntry;
class DeadKeyTable;


class VirtualKey
{
public:
  //  0 - Normal
  //  1 - Shift
  //  2 - Control
  //  3 - Control + Shift
  //  4 - Alt
  //  5 - Alt + Shift
  //  6 - Alt + Control (AltGr)
  //  7 - Alt + Control + Shift (AltGr + Shift)
  //  8 - CapsLock
  //  9 - CapsLock + Shift
  // 10 - CapsLock + Control
  // 11 - CapsLock + Control + Shift
  // 12 - CapsLock + Alt
  // 13 - CapsLock + Alt + Shift
  // 14 - CapsLock + Alt + Control (CapsLock + AltGr)
  // 15 - CapsLock + Alt + Control + Shift (CapsLock + AltGr + Shift)

  enum ShiftStateFlag
  {
    STATE_SHIFT    = 0x01,
    STATE_CONTROL  = 0x02,
    STATE_ALT      = 0x04,
    STATE_CAPSLOCK = 0x08
  };

  typedef uint8_t ShiftState;

  static ShiftState ModifiersToShiftState(Modifiers aModifiers);
  static Modifiers ShiftStateToModifiers(ShiftState aShiftState);

private:
  union KeyShiftState
  {
    struct
    {
      char16_t Chars[4];
    } Normal;
    struct
    {
      const DeadKeyTable* Table;
      char16_t DeadChar;
    } DeadKey;
  };

  KeyShiftState mShiftStates[16];
  uint16_t mIsDeadKey;

  void SetDeadKey(ShiftState aShiftState, bool aIsDeadKey)
  {
    if (aIsDeadKey) {
      mIsDeadKey |= 1 << aShiftState;
    } else {
      mIsDeadKey &= ~(1 << aShiftState);
    }
  }

public:
  static void FillKbdState(PBYTE aKbdState, const ShiftState aShiftState);

  bool IsDeadKey(ShiftState aShiftState) const
  {
    return (mIsDeadKey & (1 << aShiftState)) != 0;
  }

  void AttachDeadKeyTable(ShiftState aShiftState,
                          const DeadKeyTable* aDeadKeyTable)
  {
    mShiftStates[aShiftState].DeadKey.Table = aDeadKeyTable;
  }

  void SetNormalChars(ShiftState aShiftState, const char16_t* aChars,
                      uint32_t aNumOfChars);
  void SetDeadChar(ShiftState aShiftState, char16_t aDeadChar);
  const DeadKeyTable* MatchingDeadKeyTable(const DeadKeyEntry* aDeadKeyArray,
                                           uint32_t aEntries) const;
  inline char16_t GetCompositeChar(ShiftState aShiftState,
                                    char16_t aBaseChar) const;
  UniCharsAndModifiers GetNativeUniChars(ShiftState aShiftState) const;
  UniCharsAndModifiers GetUniChars(ShiftState aShiftState) const;
};

class MOZ_STACK_CLASS NativeKey final
{
  friend class KeyboardLayout;

public:
  struct FakeCharMsg
  {
    UINT mCharCode;
    UINT mScanCode;
    bool mIsSysKey;
    bool mIsDeadKey;
    bool mConsumed;

    FakeCharMsg()
      : mCharCode(0)
      , mScanCode(0)
      , mIsSysKey(false)
      , mIsDeadKey(false)
      , mConsumed(false)
    {
    }

    MSG GetCharMsg(HWND aWnd) const
    {
      MSG msg;
      msg.hwnd = aWnd;
      msg.message = mIsDeadKey && mIsSysKey ? WM_SYSDEADCHAR :
                                 mIsDeadKey ? WM_DEADCHAR :
                                  mIsSysKey ? WM_SYSCHAR :
                                              WM_CHAR;
      msg.wParam = static_cast<WPARAM>(mCharCode);
      msg.lParam = static_cast<LPARAM>(mScanCode << 16);
      msg.time = 0;
      msg.pt.x = msg.pt.y = 0;
      return msg;
    }
  };

  NativeKey(nsWindowBase* aWidget,
            const MSG& aMessage,
            const ModifierKeyState& aModKeyState,
            HKL aOverrideKeyboardLayout = 0,
            nsTArray<FakeCharMsg>* aFakeCharMsgs = nullptr);

  ~NativeKey();

  /**
   * Handle WM_KEYDOWN message or WM_SYSKEYDOWN message.  The instance must be
   * initialized with WM_KEYDOWN or WM_SYSKEYDOWN.
   * Returns true if dispatched keydown event or keypress event is consumed.
   * Otherwise, false.
   */
  bool HandleKeyDownMessage(bool* aEventDispatched = nullptr) const;

  /**
   * Handles WM_CHAR message or WM_SYSCHAR message.  The instance must be
   * initialized with WM_KEYDOWN, WM_SYSKEYDOWN or them.
   * Returns true if dispatched keypress event is consumed.  Otherwise, false.
   */
  bool HandleCharMessage(const MSG& aCharMsg,
                         bool* aEventDispatched = nullptr) const;

  /**
   * Handles keyup message.  Returns true if the event is consumed.
   * Otherwise, false.
   */
  bool HandleKeyUpMessage(bool* aEventDispatched = nullptr) const;

  /**
   * Handles WM_APPCOMMAND message.  Returns true if the event is consumed.
   * Otherwise, false.
   */
  bool HandleAppCommandMessage() const;

  /**
   * Callback of TextEventDispatcherListener::WillDispatchKeyboardEvent().
   * This method sets alternative char codes of aKeyboardEvent.
   */
  void WillDispatchKeyboardEvent(WidgetKeyboardEvent& aKeyboardEvent,
                                 uint32_t aIndex);

  /**
   * Returns true if aChar is a control character which shouldn't be inputted
   * into focused text editor.
   */
  static bool IsControlChar(char16_t aChar);

private:
  NativeKey* mLastInstance;
  // mRemovingMsg is set at removing a char message from
  // GetFollowingCharMessage().
  MSG mRemovingMsg;
  // mReceivedMsg is set when another instance starts to handle the message
  // unexpectedly.
  MSG mReceivedMsg;
  RefPtr<nsWindowBase> mWidget;
  RefPtr<TextEventDispatcher> mDispatcher;
  HKL mKeyboardLayout;
  MSG mMsg;
  // mFollowingCharMsgs stores WM_CHAR, WM_SYSCHAR, WM_DEADCHAR or
  // WM_SYSDEADCHAR message which follows WM_KEYDOWN.
  // Note that the stored messaged are already removed from the queue.
  nsTArray<MSG> mFollowingCharMsgs;
  // mRemovedOddCharMsgs stores WM_CHAR messages which are caused by ATOK or
  // WXG (they are Japanese IME) when the user tries to do "Kakutei-undo"
  // (it means "undo the last commit").
  nsTArray<MSG> mRemovedOddCharMsgs;
  // If dispatching eKeyDown or eKeyPress event causes focus change,
  // the instance shouldn't handle remaning char messages.  For checking it,
  // this should store first focused window.
  HWND mFocusedWndBeforeDispatch;

  uint32_t mDOMKeyCode;
  KeyNameIndex mKeyNameIndex;
  CodeNameIndex mCodeNameIndex;

  ModifierKeyState mModKeyState;

  // mVirtualKeyCode distinguishes left key or right key of modifier key.
  uint8_t mVirtualKeyCode;
  // mOriginalVirtualKeyCode doesn't distinguish left key or right key of
  // modifier key.  However, if the given keycode is VK_PROCESS, it's resolved
  // to a keycode before it's handled by IME.
  uint8_t mOriginalVirtualKeyCode;

  // mCommittedChars indicates the inputted characters which is committed by
  // the key.  If dead key fail to composite a character, mCommittedChars
  // indicates both the dead characters and the base characters.
  UniCharsAndModifiers mCommittedCharsAndModifiers;

  // Following strings are computed by
  // ComputeInputtingStringWithKeyboardLayout() which is typically called
  // before dispatching keydown event.
  // mInputtingStringAndModifiers's string is the string to be
  // inputted into the focused editor and its modifier state is proper
  // modifier state for inputting the string into the editor.
  UniCharsAndModifiers mInputtingStringAndModifiers;
  // mShiftedString is the string to be inputted into the editor with
  // current modifier state with active shift state.
  UniCharsAndModifiers mShiftedString;
  // mUnshiftedString is the string to be inputted into the editor with
  // current modifier state without shift state.
  UniCharsAndModifiers mUnshiftedString;
  // Following integers are computed by
  // ComputeInputtingStringWithKeyboardLayout() which is typically called
  // before dispatching keydown event.  The meaning of these values is same
  // as charCode.
  uint32_t mShiftedLatinChar;
  uint32_t mUnshiftedLatinChar;

  WORD    mScanCode;
  bool    mIsExtended;
  bool    mIsDeadKey;
  // mIsPrintableKey is true if the key may be a printable key without
  // any modifier keys.  Otherwise, false.
  // Please note that the event may not cause any text input even if this
  // is true.  E.g., it might be dead key state or Ctrl key may be pressed.
  bool    mIsPrintableKey;
  // mIsOverridingKeyboardLayout is true if the instance temporarily overriding
  // keyboard layout with specified by the constructor.
  bool    mIsOverridingKeyboardLayout;

  nsTArray<FakeCharMsg>* mFakeCharMsgs;

  // When a keydown event is dispatched at handling WM_APPCOMMAND, the computed
  // virtual keycode is set to this.  Even if we consume WM_APPCOMMAND message,
  // Windows may send WM_KEYDOWN and WM_KEYUP message for them.
  // At that time, we should not dispatch key events for them.
  static uint8_t sDispatchedKeyOfAppCommand;

  NativeKey()
  {
    MOZ_CRASH("The default constructor of NativeKey isn't available");
  }

  void InitWithAppCommand();
  void InitWithKeyChar();

  /**
   * Returns true if the key event is caused by auto repeat.
   */
  bool IsRepeat() const
  {
    switch (mMsg.message) {
      case WM_KEYDOWN:
      case WM_SYSKEYDOWN:
      case WM_CHAR:
      case WM_SYSCHAR:
      case WM_DEADCHAR:
      case WM_SYSDEADCHAR:
      case MOZ_WM_KEYDOWN:
        return ((mMsg.lParam & (1 << 30)) != 0);
      case WM_APPCOMMAND:
        if (mVirtualKeyCode) {
          // If we can map the WM_APPCOMMAND to a virtual keycode, we can trust
          // the result of GetKeyboardState().
          BYTE kbdState[256];
          memset(kbdState, 0, sizeof(kbdState));
          ::GetKeyboardState(kbdState);
          return !!kbdState[mVirtualKeyCode];
        }
        // If there is no virtual keycode for the command, we dispatch both
        // keydown and keyup events from WM_APPCOMMAND handler.  Therefore,
        // even if WM_APPCOMMAND is caused by auto key repeat, web apps receive
        // a pair of DOM keydown and keyup events.  I.e., KeyboardEvent.repeat
        // should be never true of such keys.
        return false;
      default:
        return false;
    }
  }

  UINT GetScanCodeWithExtendedFlag() const;

  // The result is one of nsIDOMKeyEvent::DOM_KEY_LOCATION_*.
  uint32_t GetKeyLocation() const;

  /**
   * RemoveFollowingOddCharMessages() removes odd WM_CHAR messages from the
   * queue when IsIMEDoingKakuteiUndo() returns true.
   */
  void RemoveFollowingOddCharMessages();

  /**
   * "Kakutei-Undo" of ATOK or WXG (both of them are Japanese IME) causes
   * strange WM_KEYDOWN/WM_KEYUP/WM_CHAR message pattern.  So, when this
   * returns true, the caller needs to be careful for processing the messages.
   */
  bool IsIMEDoingKakuteiUndo() const;

  bool IsKeyDownMessage() const
  {
    return (mMsg.message == WM_KEYDOWN ||
            mMsg.message == WM_SYSKEYDOWN ||
            mMsg.message == MOZ_WM_KEYDOWN);
  }
  bool IsKeyUpMessage() const
  {
    return (mMsg.message == WM_KEYUP ||
            mMsg.message == WM_SYSKEYUP ||
            mMsg.message == MOZ_WM_KEYUP);
  }
  bool IsPrintableCharMessage(const MSG& aMSG) const
  {
    return IsPrintableCharMessage(aMSG.message);
  }
  bool IsPrintableCharMessage(UINT aMessage) const
  {
    return (aMessage == WM_CHAR || aMessage == WM_SYSCHAR);
  }
  bool IsCharMessage(const MSG& aMSG) const
  {
    return IsCharMessage(aMSG.message);
  }
  bool IsCharMessage(UINT aMessage) const
  {
    return (IsPrintableCharMessage(aMessage) || IsDeadCharMessage(aMessage));
  }
  bool IsDeadCharMessage(const MSG& aMSG) const
  {
    return IsDeadCharMessage(aMSG.message);
  }
  bool IsDeadCharMessage(UINT aMessage) const
  {
    return (aMessage == WM_DEADCHAR || aMessage == WM_SYSDEADCHAR);
  }
  bool IsSysCharMessage(const MSG& aMSG) const
  {
    return IsSysCharMessage(aMSG.message);
  }
  bool IsSysCharMessage(UINT aMessage) const
  {
    return (aMessage == WM_SYSCHAR || aMessage == WM_SYSDEADCHAR);
  }
  bool MayBeSameCharMessage(const MSG& aCharMsg1, const MSG& aCharMsg2) const;
  bool IsFollowedByNonControlCharMessage() const;
  bool IsFollowedByDeadCharMessage() const;
  bool IsKeyMessageOnPlugin() const
  {
    return (mMsg.message == MOZ_WM_KEYDOWN ||
            mMsg.message == MOZ_WM_KEYUP);
  }

  /**
   * GetFollowingCharMessage() returns following char message of handling
   * keydown event.  If the message is found, this method returns true.
   * Otherwise, returns false.
   *
   * WARNING: Even if this returns true, aCharMsg may be WM_NULL or its
   *          hwnd may be different window.
   */
  bool GetFollowingCharMessage(MSG& aCharMsg);

  /**
   * Whether the key event can compute virtual keycode from the scancode value.
   */
  bool CanComputeVirtualKeyCodeFromScanCode() const;

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VSC_TO_VK.
   */
  uint8_t ComputeVirtualKeyCodeFromScanCode() const;

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VSC_TO_VK_EX.
   */
  uint8_t ComputeVirtualKeyCodeFromScanCodeEx() const;

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VK_TO_VSC_EX or MAPVK_VK_TO_VSC.
   */
  uint16_t ComputeScanCodeExFromVirtualKeyCode(UINT aVirtualKeyCode) const;

  /**
   * Wraps MapVirtualKeyEx() with MAPVK_VSC_TO_VK and MAPVK_VK_TO_CHAR.
   */
  char16_t ComputeUnicharFromScanCode() const;

  /**
   * Initializes the aKeyEvent with the information stored in the instance.
   */
  nsEventStatus InitKeyEvent(WidgetKeyboardEvent& aKeyEvent,
                             const ModifierKeyState& aModKeyState,
                             const MSG* aMsgSentToPlugin = nullptr) const;
  nsEventStatus InitKeyEvent(WidgetKeyboardEvent& aKeyEvent,
                             const MSG* aMsgSentToPlugin = nullptr) const;

  /**
   * Dispatches a command event for aEventCommand.
   * Returns true if the event is consumed.  Otherwise, false.
   */
  bool DispatchCommandEvent(uint32_t aEventCommand) const;

  /**
   * DispatchKeyPressEventsWithoutCharMessage() dispatches keypress event(s)
   * without char messages.  So, this should be used only when there are no
   * following char messages.
   */
  bool DispatchKeyPressEventsWithoutCharMessage() const;

  /**
   * MaybeDispatchPluginEventsForRemovedCharMessages() dispatches plugin events
   * for removed char messages when a windowless plugin has focus.
   * Returns true if the widget is destroyed or blurred during dispatching a
   * plugin event.
   */
  bool MaybeDispatchPluginEventsForRemovedCharMessages() const;

  /**
   * DispatchKeyPressEventForFollowingCharMessage() dispatches keypress event
   * for following WM_*CHAR message which is removed and set to aCharMsg.
   * Returns true if the event is consumed.  Otherwise, false.
   */
  bool DispatchKeyPressEventForFollowingCharMessage(const MSG& aCharMsg) const;

  /**
   * Checkes whether the key event down message is handled without following
   * WM_CHAR messages.  For example, if following WM_CHAR message indicates
   * control character input, the WM_CHAR message is unclear whether it's
   * caused by a printable key with Ctrl or just a function key such as Enter
   * or Backspace.
   */
  bool NeedsToHandleWithoutFollowingCharMessages() const;

  /**
   * ComputeInputtingStringWithKeyboardLayout() computes string to be inputted
   * with the key and the modifier state, without shift state and with shift
   * state.
   */
  void ComputeInputtingStringWithKeyboardLayout();

  /**
   * IsFocusedWindowChanged() returns true if focused window is changed
   * after the instance is created.
   */
  bool IsFocusedWindowChanged() const
  {
    return mFocusedWndBeforeDispatch != ::GetFocus();
  }

  // Calls of PeekMessage() from NativeKey might cause nested message handling
  // due to (perhaps) odd API hook.  NativeKey should do nothing if given
  // message is tried to be retrieved by another instance.

  /**
   * sLatestInstacne is a pointer to the newest instance of NativeKey which is
   * handling a key or char message(s).
   */
  static NativeKey* sLatestInstance;

  static const MSG EmptyMSG()
  {
    static bool sInitialized = false;
    static MSG sEmptyMSG;
    if (!sInitialized) {
      memset(&sEmptyMSG, 0, sizeof(sEmptyMSG));
      sInitialized = true;
    }
    return sEmptyMSG;
  }
  static bool IsEmptyMSG(const MSG& aMSG)
  {
    return !memcmp(&aMSG, &EmptyMSG(), sizeof(MSG));
  }

  bool IsAnotherInstanceRemovingCharMessage() const
  {
    return mLastInstance && !IsEmptyMSG(mLastInstance->mRemovingMsg);
  }
};

class KeyboardLayout
{
  friend class NativeKey;

private:
  KeyboardLayout();
  ~KeyboardLayout();

  static KeyboardLayout* sInstance;
  static nsIIdleServiceInternal* sIdleService;

  struct DeadKeyTableListEntry
  {
    DeadKeyTableListEntry* next;
    uint8_t data[1];
  };

  HKL mKeyboardLayout;

  VirtualKey mVirtualKeys[NS_NUM_OF_KEYS];
  DeadKeyTableListEntry* mDeadKeyTableListHead;
  int32_t mActiveDeadKey;                 // -1 = no active dead-key
  VirtualKey::ShiftState mDeadKeyShiftState;

  bool mIsOverridden : 1;
  bool mIsPendingToRestoreKeyboardLayout : 1;

  static inline int32_t GetKeyIndex(uint8_t aVirtualKey);
  static int CompareDeadKeyEntries(const void* aArg1, const void* aArg2,
                                   void* aData);
  static bool AddDeadKeyEntry(char16_t aBaseChar, char16_t aCompositeChar,
                                DeadKeyEntry* aDeadKeyArray, uint32_t aEntries);
  bool EnsureDeadKeyActive(bool aIsActive, uint8_t aDeadKey,
                             const PBYTE aDeadKeyKbdState);
  uint32_t GetDeadKeyCombinations(uint8_t aDeadKey,
                                  const PBYTE aDeadKeyKbdState,
                                  uint16_t aShiftStatesWithBaseChars,
                                  DeadKeyEntry* aDeadKeyArray,
                                  uint32_t aMaxEntries);
  void DeactivateDeadKeyState();
  const DeadKeyTable* AddDeadKeyTable(const DeadKeyEntry* aDeadKeyArray,
                                      uint32_t aEntries);
  void ReleaseDeadKeyTables();

  /**
   * Loads the specified keyboard layout. This method always clear the dead key
   * state.
   */
  void LoadLayout(HKL aLayout);

  /**
   * InitNativeKey() must be called when actually widget receives WM_KEYDOWN or
   * WM_KEYUP.  This method is stateful.  This saves current dead key state at
   * WM_KEYDOWN.  Additionally, computes current inputted character(s) and set
   * them to the aNativeKey.
   */
  void InitNativeKey(NativeKey& aNativeKey,
                     const ModifierKeyState& aModKeyState);

public:
  static KeyboardLayout* GetInstance();
  static void Shutdown();
  static void NotifyIdleServiceOfUserActivity();

  static bool IsPrintableCharKey(uint8_t aVirtualKey);

  /**
   * IsDeadKey() returns true if aVirtualKey is a dead key with aModKeyState.
   * This method isn't stateful.
   */
  bool IsDeadKey(uint8_t aVirtualKey,
                 const ModifierKeyState& aModKeyState) const;

  /**
   * IsSysKey() returns true if aVirtualKey with aModKeyState causes WM_SYSKEY*
   * or WM_SYS*CHAR messages.
   */
  bool IsSysKey(uint8_t aVirtualKey,
                const ModifierKeyState& aModKeyState) const;

  /**
   * MaybeInitNativeKeyWithCompositeChar() may initialize aNativeKey with
   * proper composite character when dead key produces a composite character.
   * Otherwise, just returns false.
   */
  bool MaybeInitNativeKeyWithCompositeChar(
         NativeKey& aNativeKey,
         const ModifierKeyState& aModKeyState);

  /**
   * GetUniCharsAndModifiers() returns characters which is inputted by the
   * aVirtualKey with aModKeyState.  This method isn't stateful.
   */
  UniCharsAndModifiers GetUniCharsAndModifiers(
                         uint8_t aVirtualKey,
                         const ModifierKeyState& aModKeyState) const;

  /**
   * OnLayoutChange() must be called before the first keydown message is
   * received.  LoadLayout() changes the keyboard state, that causes breaking
   * dead key state.  Therefore, we need to load the layout before the first
   * keydown message.
   */
  void OnLayoutChange(HKL aKeyboardLayout)
  {
    MOZ_ASSERT(!mIsOverridden);
    LoadLayout(aKeyboardLayout);
  }

  /**
   * OverrideLayout() loads the specified keyboard layout.
   */
  void OverrideLayout(HKL aLayout)
  {
    mIsOverridden = true;
    LoadLayout(aLayout);
  }

  /**
   * RestoreLayout() loads the current keyboard layout of the thread.
   */
  void RestoreLayout()
  {
    mIsOverridden = false;
    mIsPendingToRestoreKeyboardLayout = true;
  }

  uint32_t ConvertNativeKeyCodeToDOMKeyCode(UINT aNativeKeyCode) const;

  /**
   * ConvertNativeKeyCodeToKeyNameIndex() returns KeyNameIndex value for
   * non-printable keys (except some special keys like space key).
   */
  KeyNameIndex ConvertNativeKeyCodeToKeyNameIndex(uint8_t aVirtualKey) const;

  /**
   * ConvertScanCodeToCodeNameIndex() returns CodeNameIndex value for
   * the given scan code.  aScanCode can be over 0xE000 since this method
   * doesn't use Windows API.
   */
  static CodeNameIndex ConvertScanCodeToCodeNameIndex(UINT aScanCode);

  HKL GetLayout() const
  {
    return mIsPendingToRestoreKeyboardLayout ? ::GetKeyboardLayout(0) :
                                               mKeyboardLayout;
  }

  /**
   * This wraps MapVirtualKeyEx() API with MAPVK_VK_TO_VSC.
   */
  WORD ComputeScanCodeForVirtualKeyCode(uint8_t aVirtualKeyCode) const;

  /**
   * Implementation of nsIWidget::SynthesizeNativeKeyEvent().
   */
  nsresult SynthesizeNativeKeyEvent(nsWindowBase* aWidget,
                                    int32_t aNativeKeyboardLayout,
                                    int32_t aNativeKeyCode,
                                    uint32_t aModifierFlags,
                                    const nsAString& aCharacters,
                                    const nsAString& aUnmodifiedCharacters);
};

class RedirectedKeyDownMessageManager
{
public:
  /*
   * If a window receives WM_KEYDOWN message or WM_SYSKEYDOWM message which is
   * a redirected message, NativeKey::DispatchKeyDownAndKeyPressEvent()
   * prevents to dispatch eKeyDown event because it has been dispatched
   * before the message was redirected.  However, in some cases, WM_*KEYDOWN
   * message handler may not handle actually.  Then, the message handler needs
   * to forget the redirected message and remove WM_CHAR message or WM_SYSCHAR
   * message for the redirected keydown message.  AutoFlusher class is a helper
   * class for doing it.  This must be created in the stack.
   */
  class MOZ_STACK_CLASS AutoFlusher final
  {
  public:
    AutoFlusher(nsWindowBase* aWidget, const MSG &aMsg) :
      mCancel(!RedirectedKeyDownMessageManager::IsRedirectedMessage(aMsg)),
      mWidget(aWidget), mMsg(aMsg)
    {
    }

    ~AutoFlusher()
    {
      if (mCancel) {
        return;
      }
      // Prevent unnecessary keypress event
      if (!mWidget->Destroyed()) {
        RedirectedKeyDownMessageManager::RemoveNextCharMessage(mMsg.hwnd);
      }
      // Foreget the redirected message
      RedirectedKeyDownMessageManager::Forget();
    }

    void Cancel() { mCancel = true; }

  private:
    bool mCancel;
    RefPtr<nsWindowBase> mWidget;
    const MSG &mMsg;
  };

  static void WillRedirect(const MSG& aMsg, bool aDefualtPrevented)
  {
    sRedirectedKeyDownMsg = aMsg;
    sDefaultPreventedOfRedirectedMsg = aDefualtPrevented;
  }

  static void Forget()
  {
    sRedirectedKeyDownMsg.message = WM_NULL;
  }

  static void PreventDefault() { sDefaultPreventedOfRedirectedMsg = true; }
  static bool DefaultPrevented() { return sDefaultPreventedOfRedirectedMsg; }

  static bool IsRedirectedMessage(const MSG& aMsg);

  /**
   * RemoveNextCharMessage() should be called by WM_KEYDOWN or WM_SYSKEYDOWM
   * message handler.  If there is no WM_(SYS)CHAR message for it, this
   * method does nothing.
   * NOTE: WM_(SYS)CHAR message is posted by TranslateMessage() API which is
   * called in message loop.  So, WM_(SYS)KEYDOWN message should have
   * WM_(SYS)CHAR message in the queue if the keydown event causes character
   * input.
   */
  static void RemoveNextCharMessage(HWND aWnd);

private:
  // sRedirectedKeyDownMsg is WM_KEYDOWN message or WM_SYSKEYDOWN message which
  // is reirected with SendInput() API by
  // widget::NativeKey::DispatchKeyDownAndKeyPressEvent()
  static MSG sRedirectedKeyDownMsg;
  static bool sDefaultPreventedOfRedirectedMsg;
};

} // namespace widget
} // namespace mozilla

#endif

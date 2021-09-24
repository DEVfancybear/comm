#pragma once

#include "../CryptoTools/CryptoModule.h"
#include "../Tools/CommSecureStore.h"
#include "../Tools/WorkerThread.h"
#include "CoreModuleInternal.h"
#include "NativeModules.h"
#include <jsi/jsi.h>
#include <memory>

namespace comm {

namespace jsi = facebook::jsi;

class CommCoreModule : public facebook::react::CommCoreModuleSchemaCxxSpecJSI {
  std::shared_ptr<WorkerThread> databaseThread;
  std::shared_ptr<WorkerThread> cryptoThread;
  std::shared_ptr<CoreModuleInternal> coreModule;

  jsi::Value getDraft(jsi::Runtime &rt, const jsi::String &key) override;
  jsi::Value updateDraft(jsi::Runtime &rt, const jsi::Object &draft) override;
  jsi::Value moveDraft(
      jsi::Runtime &rt,
      const jsi::String &oldKey,
      const jsi::String &newKey) override;
  jsi::Value getAllDrafts(jsi::Runtime &rt) override;
  jsi::Value removeAllDrafts(jsi::Runtime &rt) override;
  jsi::Value removeAllMessages(jsi::Runtime &rt) override;
  jsi::Value getAllMessages(jsi::Runtime &rt) override;
  jsi::Value processMessageStoreOperations(
      jsi::Runtime &rt,
      const jsi::Array &operations) override;

  jsi::Value
  initializeCryptoAccount(jsi::Runtime &rt, const jsi::String &userId) override;
  jsi::Value getUserPublicKey(jsi::Runtime &rt) override;
  jsi::Value getUserOneTimeKeys(jsi::Runtime &rt) override;
  void scheduleOrRun(
      const std::shared_ptr<WorkerThread> &thread,
      const taskType &task);

public:
  CommCoreModule(std::shared_ptr<facebook::react::CallInvoker> jsInvoker);
  void initializeThreads();
};

} // namespace comm

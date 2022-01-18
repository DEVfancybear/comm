#include "DeviceSessionItem.h"
#include "Constants.h"

namespace comm {
namespace network {
namespace database {

std::string DeviceSessionItem::tableName = DEVICE_SESSIONS_TABLE_NAME;
const std::string DeviceSessionItem::FIELD_SESSION_ID = "SessionId";
const std::string DeviceSessionItem::FIELD_DEVICE_ID = "DeviceId";
const std::string DeviceSessionItem::FIELD_PUBKEY = "PubKey";
const std::string DeviceSessionItem::FIELD_NOTIFY_TOKEN = "NotifyToken";
const std::string DeviceSessionItem::FIELD_DEVICE_TYPE = "DeviceType";
const std::string DeviceSessionItem::FIELD_APP_VERSION = "AppVersion";
const std::string DeviceSessionItem::FIELD_DEVICE_OS = "DeviceOS";
const std::string DeviceSessionItem::FIELD_CHECKPOINT_TIME = "CheckpointTime";
const std::string DeviceSessionItem::FIELD_TTL = "TTL";

DeviceSessionItem::DeviceSessionItem(
    const std::string sessionId,
    const std::string deviceId,
    const std::string pubKey,
    const std::string notifyToken,
    const std::string deviceType,
    const std::string appVersion,
    const std::string deviceOs)
    : sessionId(sessionId),
      deviceId(deviceId),
      pubKey(pubKey),
      notifyToken(notifyToken),
      deviceType(deviceType),
      appVersion(appVersion),
      deviceOs(deviceOs) {
  this->validate();
}

DeviceSessionItem::DeviceSessionItem(const AttributeValues &itemFromDB) {
  this->assignItemFromDatabase(itemFromDB);
}

void DeviceSessionItem::validate() const {
  if (!this->sessionId.size()) {
    throw std::runtime_error("Error: SessionId is empty.");
  }
}

void DeviceSessionItem::assignItemFromDatabase(
    const AttributeValues &itemFromDB) {
  try {
    this->sessionId = itemFromDB.at(DeviceSessionItem::FIELD_SESSION_ID).GetS();
    this->deviceId = itemFromDB.at(DeviceSessionItem::FIELD_DEVICE_ID).GetS();
    this->pubKey = itemFromDB.at(DeviceSessionItem::FIELD_PUBKEY).GetS();
    this->notifyToken =
        itemFromDB.at(DeviceSessionItem::FIELD_NOTIFY_TOKEN).GetS();
    this->deviceType =
        itemFromDB.at(DeviceSessionItem::FIELD_DEVICE_TYPE).GetS();
    this->appVersion =
        itemFromDB.at(DeviceSessionItem::FIELD_APP_VERSION).GetS();
    this->deviceOs = itemFromDB.at(DeviceSessionItem::FIELD_DEVICE_OS).GetS();
    this->checkpointTime = std::stoll(
        std::string(
            itemFromDB.at(DeviceSessionItem::FIELD_CHECKPOINT_TIME).GetS())
            .c_str());
  } catch (std::out_of_range &e) {
    throw std::runtime_error(
        "Invalid device session database value " + std::string(e.what()));
  }
  this->validate();
}

std::string DeviceSessionItem::getTableName() const {
  return DeviceSessionItem::tableName;
}

std::string DeviceSessionItem::getPrimaryKey() const {
  return DeviceSessionItem::FIELD_SESSION_ID;
}

std::string DeviceSessionItem::getSessionId() const {
  return this->sessionId;
}

std::string DeviceSessionItem::getDeviceId() const {
  return this->deviceId;
}

std::string DeviceSessionItem::getPubKey() const {
  return this->pubKey;
}

std::string DeviceSessionItem::getNotifyToken() const {
  return this->notifyToken;
}

std::string DeviceSessionItem::getDeviceType() const {
  return this->deviceType;
}

std::string DeviceSessionItem::getAppVersion() const {
  return this->appVersion;
}

std::string DeviceSessionItem::getDeviceOs() const {
  return this->deviceOs;
}

long long DeviceSessionItem::getCheckpointTime() const {
  return this->checkpointTime;
}

} // namespace database
} // namespace network
} // namespace comm

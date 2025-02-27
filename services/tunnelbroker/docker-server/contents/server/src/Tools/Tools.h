#pragma once

#include <random>
#include <string>

namespace comm {
namespace network {

std::string generateRandomString(std::size_t length);
long long getCurrentTimestamp();
bool validateDeviceID(std::string deviceID);
std::string generateUUID();
bool validateSessionID(std::string sessionID);

} // namespace network
} // namespace comm

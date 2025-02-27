#include "Tools.h"
#include "ConfigManager.h"
#include "Constants.h"

#include <boost/lexical_cast.hpp>
#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>

#include <chrono>
#include <iostream>
#include <random>
#include <regex>

namespace comm {
namespace network {

std::string generateRandomString(std::size_t length) {
  const std::string CHARACTERS =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  thread_local std::random_device generator;
  std::uniform_int_distribution<> distribution(0, CHARACTERS.size() - 1);
  std::string random_string;
  for (std::size_t i = 0; i < length; ++i) {
    random_string += CHARACTERS[distribution(generator)];
  }
  return random_string;
}

long long getCurrentTimestamp() {
  using namespace std::chrono;
  return duration_cast<milliseconds>(system_clock::now().time_since_epoch())
      .count();
}

bool validateDeviceID(std::string deviceID) {
  try {
    static const std::regex deviceIDKeyserverRegexp("^ks:.*");
    if (std::regex_match(deviceID, deviceIDKeyserverRegexp)) {
      return (
          deviceID ==
          config::ConfigManager::getInstance().getParameter(
              config::ConfigManager::OPTION_DEFAULT_KEYSERVER_ID));
    }
    return std::regex_match(deviceID, DEVICEID_FORMAT_REGEX);
  } catch (const std::exception &e) {
    std::cout << "Tools: "
              << "Got an exception at `validateDeviceID`: " << e.what()
              << std::endl;
    return false;
  }
}

std::string generateUUID() {
  thread_local boost::uuids::random_generator random_generator;
  return boost::uuids::to_string(random_generator());
}

bool validateSessionID(std::string sessionID) {
  try {
    return std::regex_match(sessionID, SESSION_ID_FORMAT_REGEX);
  } catch (const std::exception &e) {
    std::cout << "Tools: "
              << "Got an exception at `validateSessionId`: " << e.what()
              << std::endl;
    return false;
  }
}

} // namespace network
} // namespace comm

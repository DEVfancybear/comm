#pragma once

#include <amqpcpp.h>
#include <amqpcpp/libuv.h>

#include <atomic>
#include <memory>
#include <string>

namespace comm {
namespace network {

class AmqpManager {
  AmqpManager(){};

  std::unique_ptr<AMQP::TcpChannel> amqpChannel;
  std::atomic<bool> amqpReady;
  std::atomic<long long> lastConnectionTimestamp;
  void connectInternal();

public:
  static AmqpManager &getInstance();
  void connect();
  bool
  send(std::string toDeviceID, std::string fromDeviceID, std::string payload);
  void ack(uint64_t deliveryTag);

  AmqpManager(AmqpManager const &) = delete;
  void operator=(AmqpManager const &) = delete;
};

} // namespace network
} // namespace comm

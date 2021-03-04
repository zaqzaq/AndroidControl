/*
 *
 * MIT License
 *
 * Copyright (c) 2017 朱辉 https://blog.yeetor.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

package com.yeetor.server.handler;

import io.netty.buffer.ByteBuf;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.http.*;
import io.netty.handler.codec.http.websocketx.*;
import io.netty.util.ReferenceCountUtil;
import org.apache.commons.lang3.ArrayUtils;
import org.apache.log4j.Logger;



public class WSHandler extends SimpleChannelInboundHandler<Object> {
    private static Logger logger = Logger.getLogger(WSHandler.class);
    private static boolean autorelease = false;

    /**
     * Websocket 连接帧
     */
    WebSocketServerHandshaker handshaker = null;
    /**
     * 该Handler对应的
     */
    IWebsocketEvent eventListener;

    /**
     * 处理分批发送过来的二进制数据
     */
    byte binaryCache[] = new byte[0];
    
    public WSHandler(IWebsocketEvent eventListener) {
        super(autorelease);
        this.eventListener = eventListener;
    }

    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        super.channelInactive(ctx);
        if (eventListener != null) {
            eventListener.onDisconnect(ctx);
        }
    }

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, Object msg) throws Exception {
        try {
            if (msg instanceof FullHttpRequest) {
                FullHttpRequest req = (FullHttpRequest) msg;

                if (!req.getDecoderResult().isSuccess() ||
                        (!"websocket".equals(req.headers().get("Upgrade")))) {
                    ctx.fireChannelRead(req.retain());
                    return;
                }
                handleWSConnect(ctx, req);
            } else if (msg instanceof WebSocketFrame) {
                WebSocketFrame frame = (WebSocketFrame) msg;
                handlerWebSocketFrame(ctx, frame);
            }
        } catch (Exception e) {
            logger.error("数据包处理异常",e);
        } finally {
            if (!autorelease) {
                ReferenceCountUtil.release(msg);
            }
        }

    }

    private void handlerWebSocketFrame(ChannelHandlerContext ctx, WebSocketFrame frame) {
        // 判断是否关闭链路的指令
        if (frame instanceof CloseWebSocketFrame && handshaker != null) {
            handshaker.close(ctx.channel(), (CloseWebSocketFrame) frame.retain());
            return;
        }
        // 判断是否ping消息
        if (frame instanceof PingWebSocketFrame) {
            ctx.channel().write(new PongWebSocketFrame(frame.content().retain()));
            return;
        }

        if (frame instanceof TextWebSocketFrame) {
            if (eventListener != null) {
                eventListener.onTextMessage(ctx, ((TextWebSocketFrame) frame).text());
            }
        } else if (frame instanceof BinaryWebSocketFrame || frame instanceof ContinuationWebSocketFrame) {
            ByteBuf byteBuf = frame.content();
            byte[] bytes = new byte[byteBuf.readableBytes()];
            byteBuf.getBytes(0, bytes);
            binaryCache = ArrayUtils.addAll(binaryCache, bytes);
            if (frame.isFinalFragment()) {
                byte[] b = binaryCache;
                binaryCache = new byte[0];
                if (eventListener != null) {
                    eventListener.onBinaryMessage(ctx, b);
                }
            }
        }
    }
    
    private void handleWSConnect(ChannelHandlerContext ctx, FullHttpRequest msg) {
        WebSocketServerHandshakerFactory wsFactory = new WebSocketServerHandshakerFactory(
                null, null, true, Integer.MAX_VALUE, true);
        handshaker = wsFactory.newHandshaker(msg);
        if (handshaker == null) {
            WebSocketServerHandshakerFactory.sendUnsupportedWebSocketVersionResponse(ctx.channel());
        } else {
            handshaker.handshake(ctx.channel(), msg).addListener(future -> {
                if(future.isSuccess()){
                    if (eventListener != null) {
                        eventListener.onConnect(ctx);
                    }else {
                        logger.warn("链接握手失败",future.cause());
                    }
                }
            });
        }
    }
}
